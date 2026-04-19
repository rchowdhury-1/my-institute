# My Institute

Online Quran, Arabic & Islamic Studies learning centre — rebuilt in Next.js 14.

## Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS with custom design tokens
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod
- **Email**: Resend (optional — falls back to console logging)
- **Deployment**: Vercel

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key for email notifications. If omitted, form submissions are logged to the console. |
| `CONTACT_EMAIL` | Email address to receive form submissions. Defaults to `myinstitute2026@gmail.com`. |

## Pages

| Route | Description |
|---|---|
| `/` | Homepage (Hero, Services, Why Choose Us, Pricing, Testimonials, CTA) |
| `/about` | About page |
| `/packages` | Packages & pricing with FAQ |
| `/free-trial` | Free trial booking form |
| `/scholarship` | Scholarship application form |
| `/donate` | Donations page |
| `/recorded-courses` | Recorded course details |
| `/testimonials` | Video testimonials |

## Updating Content

All site content lives in `lib/content.ts`. Update that file to change:

- Brand name, email, phone, social links
- Services and descriptions
- Pricing packages
- About text
- Testimonial video IDs (replace `PLACEHOLDER_*` with real YouTube video IDs)
- FAQ answers

## Deploying to Vercel

```bash
npm i -g vercel
vercel --prod
```

Add `RESEND_API_KEY` and `CONTACT_EMAIL` in your Vercel project's Environment Variables settings.

## TODO

- [ ] Replace `PLACEHOLDER_*` YouTube video IDs in `lib/content.ts` with real testimonial video IDs
- [ ] Update `metadataBase` URL in `app/layout.tsx` to the final production domain
- [ ] Update `BASE_URL` in `app/sitemap.ts` to the final production domain
- [ ] Integrate Stripe for payment processing on the donations page (`app/donate/DonateClient.tsx`)
- [ ] Add real logo image to `public/` and update `components/layout/Header.tsx`
