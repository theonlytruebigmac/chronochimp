'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import 'swagger-ui-dist/swagger-ui.css';

export default function ApiDocsPage() {
  const swaggerUI = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initSwagger = async () => {
      if (swaggerUI.current) {
        try {
          const SwaggerUI = (await import('swagger-ui-dist/swagger-ui-bundle')).default;
          SwaggerUI({
            url: '/openapi.yaml',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUI.presets.apis,
              SwaggerUI.SwaggerUIStandalonePreset
            ],
          });
        } catch (error) {
          console.error('Failed to load Swagger UI:', error);
        }
      }
    };
    initSwagger();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <div id="swagger-ui" ref={swaggerUI} />
    </div>
  );
}