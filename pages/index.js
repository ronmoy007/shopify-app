import {
  Card,
  ContextualSaveBar,
  Form,
  FormLayout,
  Frame,
  Heading,
  Icon,
  Layout,
  Loading,
  Page,
  Select,
  TextField,
  Toast,
} from "@shopify/polaris";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { SettingsMinor } from "@shopify/polaris-icons";

const serialize = function (obj) {
  var str = [];
  for (var p in obj)
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  return str.join("&");
};

const Index = (props) => {
  const router = useRouter();

  return (
    <Page
      fullWidth
      title="Maquinas de Predicción"
      primaryAction={{
        content: <Icon source={SettingsMinor} color="base" />,
        primary: false,
        url: "/settings?" + serialize(router.query),
      }}
    >
      <Heading>Shopify app with Node and React 🎉</Heading>
      <div>Shop: {router.query.shop}</div>
    </Page>
  );
};

export default Index;
