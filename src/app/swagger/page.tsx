'use client';

export default function SwaggerPage() {
  return (
    <div style={{ margin: 0, padding: 0, height: '100vh', fontFamily: 'sans-serif' }}>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.css" />
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
      <style>{`
        html, body, #__next {
          margin: 0;
          padding: 0;
          height: 100%;
        }
        #swagger-ui {
          max-width: 100%;
        }
      `}</style>
    </div>
  );
}
