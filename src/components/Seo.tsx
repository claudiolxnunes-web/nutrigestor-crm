  import { Helmet } from "react-helmet-async";
 
 const SITE_URL = "https://soil-to-client.lovable.app";
 const APP_NAME = "Agro_RC CRM";
 
 interface SeoProps {
   title: string;
   description: string;
   path: string;
 }
 
  export const Seo = ({ title, description, path }: SeoProps) => {
    const fullTitle = title.includes(APP_NAME) ? title : `${title} | ${APP_NAME}`;
    const url = `${SITE_URL}${path}`;

    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": APP_NAME,
      "url": SITE_URL,
      "logo": `${SITE_URL}/placeholder.svg`,
      "description": "CRM especializado para o setor agropecuário.",
      "sameAs": []
    };

    const breadcrumbSchema = path !== "/" ? {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": SITE_URL
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": title,
          "item": url
        }
      ]
    } : null;

    return (
      <Helmet>
        <title>{fullTitle}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content={fullTitle} />
        <meta name="twitter:description" content={description} />
        <script type="application/ld+json">
          {JSON.stringify(organizationSchema)}
        </script>
        {breadcrumbSchema && (
          <script type="application/ld+json">
            {JSON.stringify(breadcrumbSchema)}
          </script>
        )}
      </Helmet>
    );
  };
 
 export default Seo;