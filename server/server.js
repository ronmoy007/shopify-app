import "@babel/polyfill";
import dotenv from "dotenv";
import "isomorphic-fetch";
import createShopifyAuth, { verifyRequest } from "@shopify/koa-shopify-auth";
import Shopify, { ApiVersion, DataType } from "@shopify/shopify-api";
import Koa from "koa";
import next from "next";
import Router from "koa-router";

dotenv.config();
const port = parseInt(process.env.PORT, 10) || 8081;
const dev = process.env.NODE_ENV !== "production";
const app = next({
  dev,
});
const handle = app.getRequestHandler();

Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: process.env.SCOPES.split(","),
  HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
  API_VERSION: ApiVersion.October20,
  IS_EMBEDDED_APP: true,
  // This should be replaced with your preferred storage strategy
  SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
});
console.log(process.env.SCOPES.split(","))

// Storing the currently active shops in memory will force them to re-login when your server restarts. You should
// persist this object in your app.
const ACTIVE_SHOPIFY_SHOPS = {};

var request_shops = require('request');
var options = {
  'method': 'GET',
  'url': 'https://0bhtskp6a9.execute-api.us-east-1.amazonaws.com/dev/shops',
  'headers': {
    'Content-Type': 'application/json'
  },
};

// Pedimos los datos de todas las tiendas activas que tenemos
request_shops(options, function (error, response) {
  if (error) throw new Error(error);

  console.log(response.body);
  const data = JSON.parse(response.body);

  data.forEach(function (item) {
    console.log(item);
    console.log(item['shop']);

    // Agregamos todas las tiendas al diccionario de tiendas
    ACTIVE_SHOPIFY_SHOPS[item['shop']] = process.env.SCOPES.split(",")

  });
  
});

app.prepare().then(async () => {
  const server = new Koa();
  const router = new Router();
  server.keys = [Shopify.Context.API_SECRET_KEY];
  server.use(
    createShopifyAuth({
      async afterAuth(ctx) {
        // Access token and shop available in ctx.state.shopify
        const { shop, accessToken, scope } = ctx.state.shopify;
        const host = ctx.query.host;
        ACTIVE_SHOPIFY_SHOPS[shop] = scope;

        console.log(shop)
        console.log(accessToken)
        console.log(scope)
        console.log(ACTIVE_SHOPIFY_SHOPS);

        const cliente = new Shopify.Clients.Rest(shop, accessToken);
        let resultado = await cliente.get({
          path: 'webhooks',
        });
        console.log(resultado.body);

        resultado = await cliente.get({
          path: 'script_tags',
        });
        console.log(resultado.body);

        let resultado_shop = await cliente.get({
          path: 'shop',
        });
        console.log(resultado_shop.body);
        console.log(resultado_shop.body['shop']);

        console.log('--INICIA INSTALADOR--')

        //Preguntamos si ya existía previamente esta tienda
        var request_shopID = require('request');
        var options = {
          'method': 'GET',
          'url': 'https://0bhtskp6a9.execute-api.us-east-1.amazonaws.com/dev/shops/' + resultado_shop.body['shop']['name'],
          'headers': {
            'Content-Type': 'application/json'
          },
        };

        request_shopID(options, function (error, response) {
          if (error) throw new Error(error);
        
          console.log(response.body);
          const data_shopID = JSON.parse(response.body);
        
          if (data_shopID['commerceName'] === undefined) {

            console.log('--Tienda nueva--');

            var request = require('request');
            var options = {
              'method': 'POST',
              'url': 'https://2a52c8nj3g.execute-api.us-east-1.amazonaws.com/dev/register',
              'headers': {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                "webSite": resultado_shop.body['shop']['myshopify_domain'],
                "platform": "SHOPIFY",
                "commerceName": resultado_shop.body['shop']['name'],
                "token": accessToken,
                "subscription_plan": "freemium",
                "name": resultado_shop.body['shop']['shop_owner'],
                "lastName": resultado_shop.body['shop']['shop_owner'],
                "phoneNumber": resultado_shop.body['shop']['phone'],
                "email": resultado_shop.body['shop']['customer_email'],
                "password": resultado_shop.body['shop']['customer_email'],
                "gmt": "GMT-6:00",
                "commerceAddress": {
                  "addressLine1": resultado_shop.body['shop']['address1'],
                  "addressLine2": "---Colonia---",
                  "addressLine3": "---Ninguna---",
                  "city": resultado_shop.body['shop']['city'],
                  "stateOrProvince": resultado_shop.body['shop']['province'],
                  "country": resultado_shop.body['shop']['country'],
                  "zipCode": resultado_shop.body['shop']['zip']
                },
                "commerceInfo": {
                  "sector": "--Sector---"
                },
                "send_notifications": false,
                "email_list_notifications": {
                  "email_1": resultado_shop.body['shop']['customer_email']
                }
              })
            };
            request(options, function (error, response) {
              if (error) throw new Error(error);
              console.log(response.body);
            });

          }else{

            console.log('--Tienda existente--');

            var request = require('request');
            var options = {
              'method': 'PATCH',
              'url': 'https://0bhtskp6a9.execute-api.us-east-1.amazonaws.com/dev/shops/' + resultado_shop.body['shop']['name'],
              'headers': {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                "token": accessToken,
              })
            };
            request(options, function (error, response) {
              if (error) throw new Error(error);
              console.log(response.body);
            });

          }
          
        });
        
        

       
        //const client = new Shopify.Clients.Rest('marco-prueba-01.myshopify.com', accessToken);
        resultado = await cliente.post({
          path: 'webhooks',
          data: {"webhook":
                          {"address":"arn:aws:events:us-east-1::event-source\/aws.partner\/shopify.com\/6060967\/app_prueba_webhook",
                          "topic":"app\/uninstalled",
                          "format":"json"
                          }
                },
          type: DataType.JSON,
        });
        console.log(resultado.body);

        resultado = await cliente.post({
          path: 'webhooks',
          data: {"webhook":
                          {"address":"arn:aws:events:us-east-1::event-source\/aws.partner\/shopify.com\/6060967\/app_prueba_webhook",
                          "topic":"orders\/paid",
                          "format":"json"
                          }
                },
          type: DataType.JSON,
        });
        console.log(resultado.body);

        resultado = await cliente.post({
          path: 'webhooks',
          data: {"webhook":
                          {"address":"arn:aws:events:us-east-1::event-source\/aws.partner\/shopify.com\/6060967\/app_prueba_webhook",
                          "topic":"refunds\/create",
                          "format":"json"
                          }
                },
          type: DataType.JSON,
        });
        console.log(resultado.body);
        console.log('-- Fin webhooks! --');
        
        resultado = await cliente.post({
          path: 'script_tags',
          data: {"script_tag":{"event":"onload","src":"https:\/\/pruebas-marco.s3.amazonaws.com\/prueba1.js"}},
          type: DataType.JSON,
        });
        console.log(resultado.body);
        console.log('-- Fin scripttag! --');
        
        
        // Redirect to app with shop parameter upon auth
        ctx.redirect(`/?shop=${shop}&host=${host}`);
      },
    })
  );

  const handleRequest = async (ctx) => {
    await handle(ctx.req, ctx.res);
    ctx.respond = false;
    ctx.res.statusCode = 200;
  };

  router.post("/webhooks", async (ctx) => {
    try {
      await Shopify.Webhooks.Registry.process(ctx.req, ctx.res);
      console.log(`Webhook processed, returned status code 200`);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
    }
  });

  router.post(
    "/graphql",
    verifyRequest({ returnHeader: true }),
    async (ctx, next) => {
      await Shopify.Utils.graphqlProxy(ctx.req, ctx.res);
    }
  );

  router.get("(/_next/static/.*)", handleRequest); // Static content is clear
  router.get("/_next/webpack-hmr", handleRequest); // Webpack content is clear
  router.get("(.*)", async (ctx) => {
    const shop = ctx.query.shop;

    // This shop hasn't been seen yet, go through OAuth to create a session
    
    if (ACTIVE_SHOPIFY_SHOPS[shop] === undefined) {
      console.log("--En el if--");
      ctx.redirect(`/auth?shop=${shop}`);
    } else {
      console.log("--En el else--");
      await handleRequest(ctx);
    }
  });

  server.use(router.allowedMethods());
  server.use(router.routes());
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
