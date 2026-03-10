UPDATE tenant_storefronts SET custom_css = 'body .storefront-wrapper {
  background-color: #000000;
  color: #ffffff;
}
.storefront-wrapper .border-b,
.storefront-wrapper .border-t,
.storefront-wrapper .border {
  border-color: #333333 !important;
}
.storefront-wrapper .bg-background\/95,
.storefront-wrapper .bg-background {
  background-color: #000000 !important;
}
.storefront-wrapper .bg-muted\/30,
.storefront-wrapper .bg-muted {
  background-color: #1a1a1a !important;
}
.storefront-wrapper .text-muted-foreground {
  color: #999999 !important;
}
.storefront-wrapper .text-foreground,
.storefront-wrapper h1,
.storefront-wrapper h2,
.storefront-wrapper h3,
.storefront-wrapper h4 {
  color: #ffffff !important;
}
/* Cards - fundo escuro */
.storefront-wrapper [class*="rounded-lg"][class*="border"],
.storefront-wrapper [class*="rounded-xl"][class*="border"],
.storefront-wrapper .card,
.storefront-wrapper [data-slot="card"] {
  background-color: #111111 !important;
  border-color: #333333 !important;
  color: #ffffff !important;
}
/* Badge outline */
.storefront-wrapper [class*="badge"][class*="outline"],
.storefront-wrapper .badge {
  border-color: #555555 !important;
  color: #cccccc !important;
}
/* Buttons outline */
.storefront-wrapper button[class*="outline"],
.storefront-wrapper [class*="btn-outline"] {
  border-color: #555555 !important;
  color: #ffffff !important;
}
.storefront-wrapper button[class*="ghost"] {
  color: #cccccc !important;
}
/* Input e select */
.storefront-wrapper input,
.storefront-wrapper select,
.storefront-wrapper textarea {
  background-color: #1a1a1a !important;
  border-color: #333333 !important;
  color: #ffffff !important;
}
/* Separator */
.storefront-wrapper [class*="separator"],
.storefront-wrapper hr {
  background-color: #333333 !important;
  border-color: #333333 !important;
}
/* Links e textos dentro de cards */
.storefront-wrapper p,
.storefront-wrapper span,
.storefront-wrapper a,
.storefront-wrapper label {
  color: inherit;
}
/* Preço e valores */
.storefront-wrapper .font-bold,
.storefront-wrapper .font-semibold {
  color: #ffffff !important;
}
/* Warning/amber messages */
.storefront-wrapper .bg-amber-50 {
  background-color: #2a2000 !important;
  color: #fbbf24 !important;
}' WHERE slug = 'shapefy'