export default function SwaggerPage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ethio Telecom RMS - API Swagger Docs</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.css" />
        <style>
          {`
            html, body {
              margin: 0;
              padding: 0;
              height: 100%;
              font-family: sans-serif;
            }
            #swagger-ui {
              max-width: 100%;
            }
          `}
        </style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui-bundle.js"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.onload = function() {
                window.ui = SwaggerUIBundle({
                  url: "/api/swagger.json",
                  dom_id: '#swagger-ui',
                  presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                  ],
                  layout: "StandaloneLayout",
                  persistAuthorization: true,
                })
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
