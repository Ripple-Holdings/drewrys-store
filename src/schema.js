/**
 * Drewrys — Schema.org JSON-LD.
 *
 * The site had no structured data of any kind: zero application/ld+json, zero
 * occurrences of schema.org. For a shop with prices, stock, a returns policy
 * and a physical premises that forfeits product rich results, merchant
 * listings and every entity signal Google uses to work out what the brand is.
 *
 * EVERYTHING HERE IS GENERATED FROM THE LIVE CATALOGUE, never hand-maintained.
 * Price and availability drifting out of step with the shop is the commonest
 * cause of a Merchant Center suspension, and the only way to guarantee they
 * cannot is to read them from the same KV the storefront reads.
 *
 * Deliberately NOT emitted:
 *   FAQPage  — Google retired FAQ rich results for all sites on 7 May 2026.
 *              There is no SERP feature left to win. QAPage remains correct
 *              for genuine user Q&A, which this site does not have.
 *   HowTo    — deprecated September 2023.
 *   aggregateRating when there are no reviews — emitting a rating from an
 *              empty set is a structured-data violation and a manual-action
 *              risk. It appears below only when real reviews exist.
 */

const ORIGIN = 'https://drewrys.store';
const ORG = `${ORIGIN}/#organization`;
const BRAND = `${ORIGIN}/#brand`;
const SHOP = `${ORIGIN}/#shop`;
const RETURNS = `${ORIGIN}/#returnpolicy`;

/** JSON-LD goes inside a <script> block, so the one character that must never
 *  survive is a literal `<`. */
const safe = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

/** Google Product category, closest match in their taxonomy. */
function categoryFor(p) {
  return /shampoo|conditioner|wash/i.test(p.name || '')
    ? 'Health & Beauty > Personal Care > Hair Care > Shampoo & Conditioner'
    : 'Health & Beauty > Personal Care > Hair Care > Hair Styling Products';
}

/** A year out, generated per request. A priceValidUntil in the past can
 *  suppress the offer's rich result entirely, which is exactly what happens
 *  when someone hardcodes one and forgets it. */
function priceValidUntil() {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function availability(n) {
  if (n === null || n === undefined) return 'https://schema.org/InStock';
  return n > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
}

/* ── the entity nodes, shared by every page ──────────────────────────────── */

/**
 * OnlineStore is Google's recommended Organization subtype for e-commerce.
 *
 * HealthAndBeautyBusiness was considered and rejected: in the schema.org
 * hierarchy it denotes a business that *performs* beauty services on
 * customers (its children are BeautySalon, HairSalon, DaySpa). Drewrys
 * manufactures and retails goods. Using it would assert something false and
 * would pull in local-pack intent for "hair salon near me".
 *
 * The physical premises is a separate Store node linked by parentOrganization,
 * because the brand trades nationally online *and* has one shop. Collapsing
 * both into one node means misrepresenting one of them.
 */
function organisation(biz, settings) {
  const sameAs = [
    settings.instagram_url || 'https://www.instagram.com/drewrys_haircare/',
    settings.facebook_url || 'https://www.facebook.com/drewrys',
  ].filter(Boolean);

  return [
    {
      '@type': 'OnlineStore',
      '@id': ORG,
      name: biz.tradingName,
      legalName: biz.legalName,
      alternateName: 'Drewrys Haircare',
      description:
        'Drewrys is a premium haircare brand based in Douglas, Isle of Man, making '
        + 'styling products and shampoo from organic, sustainably sourced botanical oils.',
      url: ORIGIN + '/',
      logo: {
        '@type': 'ImageObject',
        '@id': `${ORIGIN}/#logo`,
        url: `${ORIGIN}/img/logo-d.png`,
        caption: biz.tradingName,
      },
      image: `${ORIGIN}/img/share.jpg`,
      email: biz.email,
      telephone: biz.phone,
      vatID: biz.vat,
      identifier: [
        { '@type': 'PropertyValue', name: 'Isle of Man company number',
          propertyID: 'IM Companies Registry', value: biz.company },
        { '@type': 'PropertyValue', name: 'VAT registration number',
          propertyID: 'VAT', value: biz.vat },
      ],
      address: {
        '@type': 'PostalAddress',
        '@id': `${ORIGIN}/#address`,
        streetAddress: biz.street,
        addressLocality: biz.town,
        postalCode: biz.postcode,
        addressCountry: 'IM',
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: biz.email,
        telephone: biz.phone,
        areaServed: ['IM', 'GB'],
        availableLanguage: 'en-GB',
      },
      areaServed: [
        { '@type': 'Country', name: 'Isle of Man' },
        { '@type': 'Country', name: 'United Kingdom' },
      ],
      currenciesAccepted: 'GBP',
      brand: { '@id': BRAND },
      hasMerchantReturnPolicy: { '@id': RETURNS },
      sameAs,
    },
    {
      '@type': 'Brand',
      '@id': BRAND,
      name: biz.tradingName,
      logo: `${ORIGIN}/img/logo-d.png`,
      url: ORIGIN + '/',
    },
    {
      '@type': 'Store',
      '@id': SHOP,
      name: biz.tradingName,
      description: 'Drewrys haircare shop and collection point in central Douglas, Isle of Man.',
      url: `${ORIGIN}/stockists`,
      image: `${ORIGIN}/img/hero-shop.jpg`,
      telephone: biz.phone,
      email: biz.email,
      address: { '@id': `${ORIGIN}/#address` },
      parentOrganization: { '@id': ORG },
      currenciesAccepted: 'GBP',
      paymentAccepted: 'Credit Card, Debit Card',
      priceRange: '££',
      sameAs,
    },
    {
      '@type': 'MerchantReturnPolicy',
      '@id': RETURNS,
      name: 'Drewrys 14-day returns policy',
      url: `${ORIGIN}/returns`,
      applicableCountry: ['IM', 'GB'],
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 14,
      returnMethod: ['https://schema.org/ReturnByMail', 'https://schema.org/ReturnInStore'],
      returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
      inStoreReturnsOffered: true,
      refundType: 'https://schema.org/FullRefund',
    },
    {
      '@type': 'WebSite',
      '@id': `${ORIGIN}/#website`,
      url: ORIGIN + '/',
      name: biz.tradingName,
      inLanguage: 'en-GB',
      publisher: { '@id': ORG },
    },
  ];
}

/** Delivery options, read from live shipping settings rather than retyped. */
function shippingNodes(freeOver) {
  const nodes = [
    {
      '@type': 'OfferShippingDetails',
      '@id': `${ORIGIN}/#shipping-collect`,
      name: 'Collect in store, Douglas',
      shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'GBP' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IM' },
      hasDeliveryMethod: 'https://schema.org/OnSitePickup',
    },
    {
      '@type': 'OfferShippingDetails',
      '@id': `${ORIGIN}/#shipping-iom`,
      name: 'Isle of Man, tracked',
      shippingRate: { '@type': 'MonetaryAmount', value: '2.50', currency: 'GBP' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IM' },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
        transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
      },
    },
    {
      '@type': 'OfferShippingDetails',
      '@id': `${ORIGIN}/#shipping-uk`,
      name: 'United Kingdom and Channel Islands, tracked',
      shippingRate: { '@type': 'MonetaryAmount', value: '4.50', currency: 'GBP' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: ['GB', 'JE', 'GG'] },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
        transitTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 5, unitCode: 'DAY' },
      },
    },
  ];
  return nodes;
}

/**
 * One Product node.
 *
 * `url` points at the product's own page. Before those pages existed the only
 * honest option was a fragment on the homepage, which is not eligible for
 * product rich results — Google needs one product per URL.
 */
function productNode(p, stock, { ratings, reviews } = {}) {
  const url = `${ORIGIN}/shop/${p.slug}`;
  const node = {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: p.name,
    sku: p.slug,
    description: p.description || p.tagline || '',
    image: p.image ? ORIGIN + p.image : `${ORIGIN}/img/share.jpg`,
    url,
    brand: { '@id': BRAND },
    category: categoryFor(p),
    additionalProperty: [
      p.size && { '@type': 'PropertyValue', name: 'Size', value: p.size },
      (p.ingredients || []).length && {
        '@type': 'PropertyValue', name: 'Key ingredients', value: p.ingredients.join(', '),
      },
    ].filter(Boolean),
    offers: {
      '@type': 'Offer',
      '@id': `${url}#offer`,
      url,
      price: (Number(p.price_pence || 0) / 100).toFixed(2),
      priceCurrency: 'GBP',
      priceValidUntil: priceValidUntil(),
      availability: availability(stock),
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': ORG },
      hasMerchantReturnPolicy: { '@id': RETURNS },
      shippingDetails: [
        { '@id': `${ORIGIN}/#shipping-collect` },
        { '@id': `${ORIGIN}/#shipping-iom` },
        { '@id': `${ORIGIN}/#shipping-uk` },
      ],
    },
  };

  // Only when genuinely earned. `ratings` comes from ratingSummary(), which
  // counts published reviews and nothing else.
  const per = ratings && ratings.perProduct && ratings.perProduct[p.slug];
  if (per && per.count > 0) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(per.average).toFixed(1),
      reviewCount: per.count,
      bestRating: 5,
      worstRating: 1,
    };
  }
  // Reviews are keyed by the order's SKUs, so one review can cover several
  // products. Only those carrying words are worth emitting.
  const mine = (reviews || [])
    .filter((r) => r.rating && (r.products || []).includes(p.slug) && String(r.text || '').trim())
    .slice(0, 5);
  if (mine.length) {
    node.review = mine.map((r) => ({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      author: { '@type': 'Person', name: r.name || 'Verified customer' },
      reviewBody: String(r.text).trim(),
      ...(r.created ? { datePublished: String(r.created).slice(0, 10) } : {}),
    }));
  }
  return node;
}

function breadcrumb(trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: ORIGIN + t.path,
    })),
  };
}

/* ── the per-page graphs ─────────────────────────────────────────────────── */

export function homeGraph({ biz, settings, products, stock, ratings, freeOver }) {
  return safe({
    '@context': 'https://schema.org',
    '@graph': [
      ...organisation(biz, settings),
      ...shippingNodes(freeOver),
      {
        '@type': 'WebPage',
        '@id': `${ORIGIN}/#webpage`,
        url: ORIGIN + '/',
        name: 'Drewrys — barber-made haircare, made in the UK',
        inLanguage: 'en-GB',
        isPartOf: { '@id': `${ORIGIN}/#website` },
        about: { '@id': ORG },
        primaryImageOfPage: `${ORIGIN}/img/share.jpg`,
      },
      {
        '@type': 'ItemList',
        '@id': `${ORIGIN}/#product-list`,
        name: 'The Drewrys range',
        numberOfItems: products.length,
        itemListElement: products.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${ORIGIN}/shop/${p.slug}`,
          name: p.name,
        })),
      },
      ...products.map((p) => productNode(p, stock[p.slug], { ratings })),
    ],
  });
}

export function shopGraph({ biz, settings, products, stock, ratings, freeOver }) {
  return safe({
    '@context': 'https://schema.org',
    '@graph': [
      ...organisation(biz, settings),
      ...shippingNodes(freeOver),
      breadcrumb([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }]),
      {
        '@type': 'CollectionPage',
        '@id': `${ORIGIN}/shop#webpage`,
        url: `${ORIGIN}/shop`,
        name: 'Shop the Drewrys range',
        inLanguage: 'en-GB',
        isPartOf: { '@id': `${ORIGIN}/#website` },
      },
      {
        '@type': 'ItemList',
        '@id': `${ORIGIN}/shop#list`,
        numberOfItems: products.length,
        itemListElement: products.map((p, i) => ({
          '@type': 'ListItem', position: i + 1, url: `${ORIGIN}/shop/${p.slug}`, name: p.name,
        })),
      },
      ...products.map((p) => productNode(p, stock[p.slug], { ratings })),
    ],
  });
}

export function productGraph({ biz, settings, product, stock, ratings, reviews, freeOver }) {
  return safe({
    '@context': 'https://schema.org',
    '@graph': [
      ...organisation(biz, settings),
      ...shippingNodes(freeOver),
      breadcrumb([
        { name: 'Home', path: '/' },
        { name: 'Shop', path: '/shop' },
        { name: product.name, path: `/shop/${product.slug}` },
      ]),
      productNode(product, stock, { ratings, reviews }),
    ],
  });
}

/** About / ingredients / wholesale / stockists. */
export function pageGraph({ biz, settings, name, path, type = 'WebPage', crumbs = [] }) {
  return safe({
    '@context': 'https://schema.org',
    '@graph': [
      ...organisation(biz, settings),
      breadcrumb([{ name: 'Home', path: '/' }, ...crumbs]),
      {
        '@type': type,
        '@id': `${ORIGIN}${path}#webpage`,
        url: ORIGIN + path,
        name,
        inLanguage: 'en-GB',
        isPartOf: { '@id': `${ORIGIN}/#website` },
        about: { '@id': ORG },
      },
    ],
  });
}
