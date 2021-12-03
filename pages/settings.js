import {
  Avatar,
  Button,
  Card,
  Checkbox,
  ContextualSaveBar,
  EmptyState,
  Form,
  FormLayout,
  Frame,
  Icon,
  Label,
  Layout,
  Loading,
  Modal,
  Page,
  ResourceItem,
  ResourceList,
  Select,
  Stack,
  TextField,
  TextStyle,
  Toast,
} from "@shopify/polaris";
import { useMachine } from "@xstate/react";
import { createMachine, assign } from "xstate";
import { CircleCancelMinor, EditMinor } from "@shopify/polaris-icons";
import axios from "axios";
import { useRouter } from "next/router";
import { serialize } from "../utils";
import { horarios } from "../common_dicts";
import { useEffect } from "react";

function fetchSettings(context) {
  return axios({
    method: "get",
    url: `https://0bhtskp6a9.execute-api.us-east-1.amazonaws.com/dev/shops/${context.shop}`,
  });
}

function patchSettings(context) {
  return axios({
    method: "patch",
    data: context.formData,
    url: `https://0bhtskp6a9.execute-api.us-east-1.amazonaws.com/dev/shops/${context.shop}`,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

//Logic Statechart
const fetchMachine = createMachine(
  {
    id: "fetch",
    initial: "fetching",
    states: {
      fetching: {
        invoke: {
          id: "fetching-data",
          src: fetchSettings,
          onDone: {
            target: "idle",
            actions: "assign_data",
          },
          onError: "error",
        },
      },
      error: {},
      idle: {
        initial: "normal",
        states: {
          normal: {
            on: {
              TYPING: { actions: "typing" },
              TYPING_ADDRESS: { actions: "typing_address" },
              ADD_EMAIL: "adding_email",
              EDIT_EMAIL: { target: "editing_email", actions: "select_email" },
              DELETE_EMAIL: { actions: "delete_email" },
            },
          },
          adding_email: {
            on: {
              TYPING_NEW_EMAIL: { actions: "typing_new_email" },
              ADDED: {
                target: "normal",
                actions: ["add_email", "clear_new_email"],
              },
              CANCEL: { target: "normal", actions: ["clear_new_email"] },
            },
          },
          editing_email: {
            on: {
              TYPING_NEW_EMAIL: { actions: "typing_new_email" },
              EDITED: {
                target: "normal",
                actions: [
                  "edit_email",
                  "clear_selected_email",
                  "clear_new_email",
                ],
              },
              CANCEL: {
                target: "normal",
                actions: ["clear_selected_email", "clear_new_email"],
              },
            },
          },
        },
        on: {
          UPDATE: "updating",
          DISCARD: { actions: "discard" },
        },
      },
      updating: {
        invoke: {
          id: "patching-data",
          src: patchSettings,
          onDone: {
            target: "idle",
            actions: [
              assign({ originalData: (context, event) => context.formData }),
              "show_alert",
            ],
          },
          onError: "idle",
        },
      },
    },
    on: {
      DISMISS_ALERT: { actions: "dismiss_alert" },
    },
  },
  {
    actions: {
      assign_data: assign({
        formData: (context, event) => event.data.data,
        originalData: (context, event) => event.data.data,
      }),
      typing: assign({
        formData: (context, event) => ({
          ...context.formData,
          commerce_address: context.formData.commerce_address,
          [event.name]: event.value,
        }),
      }),
      typing_address: assign({
        formData: (context, event) => ({
          ...context.formData,
          commerce_address: {
            ...context.formData.commerce_address,
            [event.name]: event.value,
          },
        }),
      }),
      typing_new_email: assign({
        newEmail: (context, event) => ({
          ...context.newEmail,
          [event.name]: event.value,
        }),
      }),
      //TODO: Cambiar JS Object por JS Array en API
      //+++++++++++++++++++++++++++++++++++++++++++++++
      add_email: assign({
        formData: (context, event) => ({
          ...context.formData,
          email_list_notifications: {
            ...context.formData.email_list_notifications,
            [event.name]: event.email,
          },
        }),
      }),
      select_email: assign({
        newEmail: (context, event) => event,
        editedEmail: (context, event) => event,
      }),
      edit_email: assign({
        formData: (context, event) => {
          var newList = { ...context.formData.email_list_notifications };
          delete newList[context.editedEmail.name];
          newList = { ...newList, [event.name]: event.email };
          return { ...context.formData, email_list_notifications: newList };
        },
      }),
      clear_selected_email: assign({ editedEmail: {} }),
      delete_email: assign({
        formData: (context, event) => {
          var newList = { ...context.formData.email_list_notifications };
          delete newList[event.name];
          return { ...context.formData, email_list_notifications: newList };
        },
      }),
      clear_new_email: assign({ newEmail: {} }),
      //+++++++++++++++++++++++++++++++++++++++++++++++
      discard: assign({ formData: (context, event) => context.originalData }),
      show_alert: assign({ updatedAlert: true }),
      dismiss_alert: assign({ updatedAlert: false }),
    },
  }
);

function Settings(props) {
  const router = useRouter();
  //TODO: Checar si router.query.shop podría fallar.
  //TODO: Confirmar que esta bien quitarle a todas las tiendas el .myshopify.com
  const [state, send] = useMachine(fetchMachine, {
    context: {
      shop: router.query.shop.replace(".myshopify.com", ""),
      newEmail: {},
      formData: { commerce_address: {}, email_list_notifications: {} },
      originalData: { commerce_address: {}, email_list_notifications: {} },
    },
  });
  const { formData, originalData, updatedAlert = false } = state.context;

  //TODO: Checar alternativas (Client Side Routing?) para navegar entre distintas paginas
  return (
    <Page
      fullWidth
      breadcrumbs={[{ content: "Inicio", url: "/?" + serialize(router.query) }]}
      title="Configuración de Cuenta"
      divider
    >
      {/*State UI: Fetching*/}
      {state.matches("fetching") ? (
        <div style={{ height: "5px" }}>
          <Frame>
            {" "}
            <Loading />
          </Frame>
        </div>
      ) : null}
      <Form>
        {/*Context UI: Guardar Cambios*/}
        {JSON.stringify(formData) !== JSON.stringify(originalData) ? (
          <SaveChangesBar state={state} send={send} />
        ) : null}
        {/*State UI: Error*/}

        {/*State UI: Idle*/}
        {state.matches("idle") || state.matches("updating") ? (
          <Layout>
            <GeneralFormPanel state={state} send={send} />
            <DireccionFormPanel state={state} send={send} />
            <ConfiguracionFormPanel state={state} send={send} />
            <AddEmailModal state={state} send={send} />
            <EditEmailModal state={state} send={send} />
          </Layout>
        ) : null}
      </Form>
      {updatedAlert ? (
        <div style={{ height: "20px" }}>
          <Frame>
            {" "}
            <Toast
              content="Cambios Guardados"
              duration={2000}
              onDismiss={() => send("DISMISS_ALERT")}
            />
          </Frame>
        </div>
      ) : null}
    </Page>
  );
}

function SaveChangesBar({ state, send, ...props }) {
  return (
    <div style={{ height: "40px" }}>
      <Frame>
        <ContextualSaveBar
          alignContentFlush
          message={
            state.matches("updating")
              ? "Guardando Cambios..."
              : "Guardar Cambios"
          }
          saveAction={{
            onAction: () => send("UPDATE"),
            loading: state.matches("updating"),
            disabled: false,
            content: "Guardar",
          }}
          discardAction={{
            onAction: () => send("DISCARD"),
            disabled: state.matches("updating"),
            content: "Descartar",
          }}
        />
      </Frame>
    </div>
  );
}

function GeneralFormPanel({ state, send, ...props }) {
  const { formData } = state.context;

  return (
    <Layout.AnnotatedSection
      id="storeDetails"
      title="Datos Generales"
      description="Shopify and your customers will use this information to contact you."
    >
      <Card sectioned>
        <FormLayout>
          <FormLayout.Group>
            <TextField
              type="text"
              label="Nombre"
              name="name"
              value={formData.name || ""}
              onChange={(event) => {
                send("TYPING", { value: event, name: "name" });
              }}
              autoComplete="off"
              required
            />
            <TextField
              type="text"
              label="Apellido"
              name="last_name"
              value={formData.last_name || ""}
              onChange={(event) => {
                send("TYPING", { value: event, name: "last_name" });
              }}
              autoComplete="off"
            />
          </FormLayout.Group>
          <TextField
            type="text"
            label="Sitio Web"
            name="web_site"
            value={formData.web_site || ""}
            onChange={(event) => {
              send("TYPING", { value: event, name: "web_site" });
            }}
            autoComplete="off"
          />
          <FormLayout.Group>
            <TextField
              type="phone"
              label="Teléfono"
              name="phone_number"
              value={formData.phone_number || ""}
              onChange={(event) => {
                send("TYPING", { value: event, name: "phone_number" });
              }}
              autoComplete="off"
            />
            <TextField
              type="email"
              label="Email"
              name="email"
              value={formData.email || ""}
              onChange={(event) => {
                send("TYPING", { value: event, name: "email" });
              }}
              autoComplete="off"
            />
          </FormLayout.Group>
        </FormLayout>
      </Card>
    </Layout.AnnotatedSection>
  );
}

function DireccionFormPanel({ state, send, ...props }) {
  const { formData } = state.context;

  return (
    <Layout.AnnotatedSection
      id="storeAddress"
      title="Dirección"
      description="Shopify and your customers will use this information to contact you."
    >
      <Card sectioned>
        <FormLayout>
          <TextField
            type="text"
            label="Calle"
            name="addressLine1"
            value={formData.commerce_address.addressLine1 || ""}
            onChange={(event) => {
              send("TYPING_ADDRESS", { value: event, name: "addressLine1" });
            }}
            autoComplete="off"
          />
          <FormLayout.Group>
            <TextField
              type="text"
              label="Número Interior"
              name="addressLine3"
              value={formData.commerce_address.addressLine3 || ""}
              onChange={(event) => {
                send("TYPING_ADDRESS", { value: event, name: "addressLine3" });
              }}
              autoComplete="off"
            />
            <TextField
              type="text"
              label="Colonia"
              name="addressLine2"
              value={formData.commerce_address.addressLine2 || ""}
              onChange={(event) => {
                send("TYPING_ADDRESS", { value: event, name: "addressLine2" });
              }}
              autoComplete="off"
            />
          </FormLayout.Group>
          <FormLayout.Group>
            <TextField
              type="text"
              label="C.P."
              name="zipCode"
              value={formData.commerce_address.zipCode || ""}
              onChange={(event) => {
                send("TYPING_ADDRESS", { value: event, name: "zipCode" });
              }}
              autoComplete="off"
            />
            <TextField
              type="text"
              label="Ciudad"
              name="city"
              value={formData.commerce_address.city || ""}
              onChange={(event) => {
                send("TYPING_ADDRESS", { value: event, name: "city" });
              }}
              autoComplete="off"
            />
          </FormLayout.Group>
          <FormLayout.Group>
            <TextField
              type="text"
              label="Estado"
              name="stateOrProvince"
              value={formData.commerce_address.stateOrProvince || ""}
              onChange={(event) => {
                send("TYPING_ADDRESS", {
                  value: event,
                  name: "stateOrProvince",
                });
              }}
              autoComplete="off"
            />
            <TextField
              type="text"
              label="País"
              name="country"
              value={formData.commerce_address.country || ""}
              onChange={(event) => {
                send("TYPING_ADDRESS", { value: event, name: "country" });
              }}
              autoComplete="off"
            />
          </FormLayout.Group>
        </FormLayout>
      </Card>
    </Layout.AnnotatedSection>
  );
}

function ConfiguracionFormPanel({ state, send, ...props }) {
  const { formData } = state.context;

  return (
    <Layout.AnnotatedSection
      id="storeConfiguration"
      title="Configuración"
      description="Shopify and your customers will use this information to contact you."
    >
      <Card sectioned>
        <FormLayout>
          <Select
            label="Zona Horaria"
            options={horarios}
            onChange={(event) => send("TYPING", { value: event, name: "gmt" })}
            value={formData.gmt}
          />
          <TextField
            type="password"
            label="API Key"
            name="api_key"
            value={formData.api_key || ""}
            onChange={(event) => {
              send("TYPING", { value: event, name: "api_key" });
            }}
            autoComplete="off"
          />
          <Checkbox
            label="Notificaciones por Correo"
            checked={formData.send_notifications}
            onChange={(event) =>
              send("TYPING", { value: event, name: "send_notifications" })
            }
          />
          <Stack alignment="center" distribution="equalSpacing">
            <Label>Email de Notificación</Label>
            {JSON.stringify(formData.email_list_notifications) != "{}" ? (
              <Button primary onClick={() => send("ADD_EMAIL")}>
                Agregar
              </Button>
            ) : null}
          </Stack>
          {JSON.stringify(formData.email_list_notifications) == "{}" ? (
            <EmptyState
              heading="Recibe Notificaciones por Email"
              action={{ content: "Agregar", onClick: () => send("ADD_EMAIL") }}
            >
              <p>
                Descripción de los beneficios que tiene registrarse para recibir
                notificaciones
              </p>
            </EmptyState>
          ) : (
            <ResourceList
              resourceName={{ singular: "customer", plural: "customers" }}
              items={
                //TODO: Cambiar JS Object por JS Array en API
                Object.entries(formData.email_list_notifications).map(
                  (element, index) => {
                    return {
                      id: element[0],
                      name: element[0],
                      email: element[1],
                    };
                  }
                )
              }
              renderItem={(item) => {
                const { id, name, email } = item;
                const media = <Avatar customer size="medium" name={name} />;
                return (
                  <ResourceItem
                    id={id}
                    media={media}
                    accessibilityLabel={`View details for ${name}`}
                    onClick={() => send("EDIT_EMAIL", { name, email })}
                  >
                    <Stack alignment="center" distribution="equalSpacing">
                      <>
                        <h3>
                          <TextStyle variation="strong">{name}</TextStyle>
                        </h3>
                        <div>{email}</div>
                      </>
                      <>
                        <Button
                          outline
                          size="slim"
                          destructive
                          onClick={() => send("DELETE_EMAIL", { name, email })}
                        >
                          <Icon source={CircleCancelMinor} color="base" />
                        </Button>
                      </>
                    </Stack>
                  </ResourceItem>
                );
              }}
            />
          )}
        </FormLayout>
      </Card>
    </Layout.AnnotatedSection>
  );
}

function AddEmailModal({ state, send, ...props }) {
  const { formData, newEmail } = state.context;

  return (
    <Modal
      open={state.matches({ idle: "adding_email" })}
      onClose={() => send("CANCEL")}
      title="Agregar Email para notificaciones"
      primaryAction={{
        content: "Agregar",
        disabled: !newEmail.name || !newEmail.email,
        onAction: () =>
          send("ADDED", { name: newEmail.name, email: newEmail.email }),
      }}
    >
      <Modal.Section>
        <FormLayout>
          <FormLayout.Group>
            <TextField
              type="text"
              label="Nombre"
              name="name"
              value={newEmail.name || ""}
              onChange={(event) => {
                send("TYPING_NEW_EMAIL", { value: event, name: "name" });
              }}
              autoComplete="off"
            />
            <TextField
              type="email"
              label="Email"
              name="email"
              value={newEmail.email || ""}
              onChange={(event) => {
                send("TYPING_NEW_EMAIL", { value: event, name: "email" });
              }}
              autoComplete="off"
            />
          </FormLayout.Group>
        </FormLayout>
      </Modal.Section>
    </Modal>
  );
}

function EditEmailModal({ state, send, ...props }) {
  const { formData, newEmail } = state.context;

  return (
    <Modal
      open={state.matches({ idle: "editing_email" })}
      onClose={() => send("CANCEL")}
      title="Editar Email para notificaciones"
      primaryAction={{
        content: "Aceptar",
        disabled: !newEmail.name || !newEmail.email,
        onAction: () =>
          send("EDITED", { name: newEmail.name, email: newEmail.email }),
      }}
    >
      <Modal.Section>
        <FormLayout>
          <FormLayout.Group>
            <TextField
              type="text"
              label="Nombre"
              name="name"
              value={newEmail.name || ""}
              onChange={(event) => {
                send("TYPING_NEW_EMAIL", { value: event, name: "name" });
              }}
              autoComplete="off"
            />
            <TextField
              type="email"
              label="Email"
              name="email"
              value={newEmail.email || ""}
              onChange={(event) => {
                send("TYPING_NEW_EMAIL", { value: event, name: "email" });
              }}
              autoComplete="off"
            />
          </FormLayout.Group>
        </FormLayout>
      </Modal.Section>
    </Modal>
  );
}

export default Settings;
