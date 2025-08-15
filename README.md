# Facebook (Meta) Pixel by Stape for Google Tag Manager Web

The **Facebook (Meta) Pixel by Stape** tag integrates Meta Pixel into your website via Google Tag Manager Web container. It allows sending standard or custom events to Meta (Facebook), including enhanced conversions and user data for improved attribution.

## How to Use

1. Add the **Facebook (Meta) Pixel by Stape** tag to your Web GTM container.
2. Enter one or more **Facebook Pixel IDs** (comma-separated).
3. Choose how the **Event Name** is defined:
   - **Inherit from Data Layer** — maps GTM/GA4 event names to Meta equivalents.
   - **Override** — choose from standard events or provide a custom event name.
4. Enable **Automatic Data Layer Mapping** (recommended) to parse GA4, UA, and Common Event Data formats.
5. (Optional) Enable **Advanced Matching** to securely pass user data (e.g., email, phone) to Meta for better match rates.
6. (Optional) Enable **Event Enhancement** to store and reuse user data via `localStorage` across sessions.
7. (Optional) Configure **Consent Settings** using either GTM Consent Mode or manual control.
8. (Optional) Activate **Limited Data Use (LDU)** for California data compliance and specify Country/State codes.
9. (Optional) Enable **Server-Side Tracking Support** using Event ID and Data Layer push for deduplication with Conversions API.
10. Adjust **Settings** for automatic configuration (automatic events collection, such as button clicks and page metadata capture) and history event tracking (mainly for SPA websites).

## Event Name Setup Options

- **Standard Events** (when overriding):
  - `PageView`, `AddToCart`, `Purchase`, `Lead`, `ViewContent`, etc.
- **Inherit from Client** (default):
  - Maps GA4 events like `purchase`, `add_to_cart`, `sign_up`, etc., to Meta equivalents.

## Required Fields

- **Facebook Pixel ID(s)** — must be a numeric string or comma-separated list.
- **Event Name** — must be resolved either from Data Layer or override settings.

## Features

### Advanced Matching

Securely enrich events with **user identifiers** such as:
- **Email** (`em`)
- **Phone** (`ph`)
- **Name, Address, External ID**, and more

Meta recommends hashing PII using SHA256. The tag will hash values if not already hashed.

- User data can be sourced from:
  - Manually entered table
  - Data Layer (`user_data`)
  - Custom variable (e.g., User-Provided Data Variable)

### Event Enhancement

When enabled, user data is stored in `localStorage` to persist across events and sessions. It improves match quality for repeat or multi-page actions.

### Consent Settings

Support for:
- **GTM Consent Mode** — respects `ad_storage` signals.
- **Manual Consent Check** — prevent tracking until explicit approval.
- **Limited Data Use (LDU)** — for U.S. states with data restrictions.

### Server-Side Deduplication

If using both client- and server-side Meta tracking:
- Use **Event ID** to deduplicate conversions.
- Enable **DataLayer Push** with a matching event name and object for synchronization.

### Object and Event Properties

Send additional metadata via:
- **Object Properties Table**
- **Data Layer Mapping** (GA4)
- **Custom Variable (JavaScript Object)**

Includes support for:
- `value`, `currency`, `content_ids`, `contents`, `num_items`, and others depending on ecommerce format.

### Other Settings

- Disable automatic `fbq('set','autoConfig')`, which disables automatic events such as button clicks and page metadata capture.
- Disable PageView automatic tracking on SPA websites.

## Open Source

The **Facebook (Meta) Pixel by Stape** tag for GTM Web is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.
