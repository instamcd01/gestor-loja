/**
 * Dados estruturados (schema.org) pro Google. `<` escapado porque nome e
 * descrição de produto vêm do cadastro — um "</script>" no texto fecharia
 * a tag e viraria HTML solto na página.
 */
export function JsonLd({ dados }: { dados: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(dados).replace(/</g, "\\u003c") }}
    />
  );
}
