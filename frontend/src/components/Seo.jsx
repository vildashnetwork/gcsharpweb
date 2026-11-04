// components/Seo.jsx
//
// index.html can only set ONE title/description for the whole app, but
// this is a multi-route SPA — Dashboard, VideoLibrary, a video detail
// page etc. all need their own title/description/canonical to be
// properly indexed and to earn distinct sitelinks. This component lets
// each public page override those tags on mount.
//
// Setup (one-time):
//   npm install react-helmet-async
//
// Then wrap the app once, in App.jsx:
//
//   import { HelmetProvider } from "react-helmet-async";
//
//   function App() {
//     return (
//       <HelmetProvider>
//         <ThemeProvider>
//           <AuthProvider>
//             <BrowserRouter>
//               <AppRouter />
//               <Toaster position="top-right" richColors />
//             </BrowserRouter>
//           </AuthProvider>
//         </ThemeProvider>
//       </HelmetProvider>
//     );
//   }
//
// Then in any PUBLIC page component (VideoLibrary.jsx is the one that
// actually matters here, since it's the only content route that isn't
// behind auth):
//
//   import { Seo } from "@/components/Seo";
//
//   export default function VideoLibrary() {
//     return (
//       <>
//         <Seo
//           title="Video Solutions Library"
//           description="Watch narrated, step-by-step AI video solutions for GCE, HND and Concours past paper questions."
//           path="/videos"
//         />
//         {/* ...existing page content... */}
//       </>
//     );
//   }
//
// For the dynamic /videos/:videoId route, pass the actual video's
// title/description once it's loaded, e.g.
// title={video ? `${video.title} — GCSHARP` : "Video Solution — GCSHARP"}
//
// Auth-gated pages (Dashboard, StudyCenter, AITutor, etc.) don't need
// this — they're disallowed in robots.txt and shouldn't be indexed.

import { Helmet } from "react-helmet-async";

const SITE_NAME = "GCSHARP";
const SITE_URL = "https://gcsharp.com";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

export function Seo({ title, description, path = "/", image = DEFAULT_IMAGE, noindex = false }) {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} · AI-Powered GCE, HND & Concours Past Papers`;
    const url = `${SITE_URL}${path}`;

    return (
        <Helmet>
            <title>{fullTitle}</title>
            {description && <meta name="description" content={description} />}
            <link rel="canonical" href={url} />
            {noindex && <meta name="robots" content="noindex, nofollow" />}

            <meta property="og:type" content="website" />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:title" content={fullTitle} />
            {description && <meta property="og:description" content={description} />}
            <meta property="og:url" content={url} />
            <meta property="og:image" content={image} />

            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            {description && <meta name="twitter:description" content={description} />}
            <meta name="twitter:image" content={image} />
        </Helmet>
    );
}