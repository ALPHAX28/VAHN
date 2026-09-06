import type { ShopifyPage } from '@/lib/api/types';

export const STATIC_PAGES: Record<string, ShopifyPage> = {
  'privacy-policy': {
    id: 'page-privacy-policy',
    handle: 'privacy-policy',
    title: 'Privacy Policy',
    bodySummary: 'VAHN Studios privacy policy issued in accordance with the Digital Personal Data Protection Act, 2023.',
    seo: {
      title: 'Privacy Policy | VAHN',
      description: 'Learn how VAHN collects, uses, and protects your personal data.',
    },
    body: `
      <div class="vahn-page-content">
        <p class="vahn-page-meta"><strong>Last updated:</strong> 02.09.2026</p>
        
        <p>VAHN STUDIOS ("VAHN") respects your privacy. This policy explains what personal data we collect, why we collect it, who we share it with, and the rights you have over it. It is issued in accordance with the Digital Personal Data Protection Act, 2023 and the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.</p>

        <h3>What We Collect</h3>
        <p><strong>Information you give us:</strong> Name, email address, phone number, billing and shipping address, and order history. If you contact support, we retain that correspondence.</p>
        <p><strong>Information collected automatically:</strong> IP address, browser and device type, pages visited, referring URL, and time spent on the Site, collected through cookies and similar technologies.</p>
        <p><strong>Payment information:</strong> We do not collect or store your card, UPI, or bank details. Payments are processed directly by our payment gateway partner, who handles that data under their own privacy policy and PCI-DSS obligations.</p>

        <h3>Why We Use It</h3>
        <p>To process and deliver your order; to send order and shipping updates; to handle returns, refunds, and support requests; to meet tax, accounting, and legal obligations; to prevent fraud; to improve the Site and our products; and, where you have opted in, to send marketing communications.</p>

        <h3>Who We Share It With</h3>
        <p>We share only what is necessary, and only with: our payment gateway; our logistics and courier partners, who receive your name, address, and phone number to deliver your order; our email and analytics providers; and government authorities where required by law. <strong>We do not sell your personal data.</strong></p>

        <h3>Cookies</h3>
        <p>We use cookies to keep your cart working, remember preferences, and understand how the Site is used. You can disable cookies in your browser settings, though parts of the Site may not function correctly if you do.</p>

        <h3>Retention</h3>
        <p>We retain order and transaction records for as long as required under Indian tax and accounting law, generally eight years. Marketing data is retained until you withdraw consent. Support correspondence is retained for 2 years.</p>

        <h3>Contact</h3>
        <p>For any privacy inquiries or to exercise your rights under Indian data protection law, contact us at <a href="mailto:support@vahnsports.com">support@vahnsports.com</a>.</p>
      </div>
    `,
  },

  'terms-and-conditions': {
    id: 'page-terms-and-conditions',
    handle: 'terms-and-conditions',
    title: 'Terms & Conditions',
    bodySummary: 'Terms and Conditions of VAHN (operated by VAHN STUDIOS).',
    seo: {
      title: 'Terms & Conditions | VAHN',
      description: 'Terms & Conditions governing the use of VAHN website and orders.',
    },
    body: `
      <div class="vahn-page-content">
        <p class="vahn-page-meta"><strong>Last updated:</strong> 02.09.2026</p>
        
        <p>Welcome to VAHN (<strong>www.vahnsports.com</strong>), operated by VAHN STUDIOS ("VAHN", "we", "us", "our"), a sole proprietorship registered in India with GSTIN and principal place of business at New Delhi. By accessing the Site, placing an order, or creating an account, you agree to these Terms & Conditions.</p>

        <h3>SECTION 1: Products and Descriptions</h3>
        <p>We make every effort to display our products, colours, and fabric detail as accurately as possible. Screen calibration varies between devices, and minor variation in colour, print placement, or finish is inherent to garment manufacturing and is not a defect.</p>
        <p>All products are sold in limited quantities. Availability is not guaranteed until your order is confirmed and payment is received.</p>

        <h3>SECTION 2: Pricing and Payment</h3>
        <p>All prices are listed in Indian Rupees (INR) and are inclusive of applicable taxes unless stated otherwise. Shipping charges, where applicable, are shown at checkout before payment.</p>
        <p>We currently accept prepaid payments only, processed through our third-party payment gateway. We do not store your card or banking details.</p>
        <p>While we take care to list prices accurately, errors may occur. If a product is listed at an incorrect price, we reserve the right to cancel the order and issue a full refund. We will contact you before doing so.</p>

        <h3>SECTION 3: Order Acceptance</h3>
        <p>Your order is an offer to purchase. We reserve the right to accept or decline any order, in whole or in part, including where we suspect fraud, where stock is unavailable, or where a pricing or listing error has occurred. A confirmation email is an acknowledgement of your order, not acceptance of it. Acceptance occurs when the order is dispatched.</p>

        <h3>SECTION 4: Intellectual Property</h3>
        <p>All content on the Site — including the VAHN name and word mark, logos, the slash device, graphics, product designs, photography, copy, and page layout — is owned by VAHN and protected under Indian copyright and trademark law. You may not reproduce, distribute, or create derivative works from it, or use it commercially, without our prior written permission.</p>
        <p>You may share our product images and content on social media for personal, non-commercial purposes with attribution to VAHN.</p>

        <h3>SECTION 5: User Conduct</h3>
        <p>You agree not to use the Site to transmit unlawful, infringing, or malicious content; to attempt unauthorised access to our systems; to use automated tools to scrape, mass-purchase, or interfere with the Site; or to resell our products as authorised VAHN merchandise without written agreement.</p>

        <h3>SECTION 6: Third-Party Links</h3>
        <p>The Site may link to third-party websites and services. We are not responsible for their content, policies, or practices.</p>

        <h3>SECTION 7: Limitation of Liability</h3>
        <p>To the maximum extent permitted under Indian law, our total liability for any claim arising out of your purchase is limited to the amount you paid for the product in question. We are not liable for indirect or consequential losses. Nothing in these Terms limits your rights under the Consumer Protection Act, 2019.</p>

        <h3>SECTION 8: Governing Law and Jurisdiction</h3>
        <p>These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts at New Delhi.</p>

        <h3>SECTION 9: Changes</h3>
        <p>We may update these Terms at any time. The version published on the Site at the time of your order applies to that order.</p>

        <h3>SECTION 10: Contact</h3>
        <p>Questions about these Terms: <a href="mailto:support@vahnsports.com">support@vahnsports.com</a></p>
      </div>
    `,
  },

  'shipping': {
    id: 'page-shipping',
    handle: 'shipping',
    title: 'Shipping & Return Policy',
    bodySummary: 'VAHN Shipping, Returns, Refunds, Exchanges, and Cancellation Policy.',
    seo: {
      title: 'Shipping & Returns | VAHN',
      description: 'Pan-India shipping details, delivery timelines, and 10-day return policy.',
    },
    body: `
      <div class="vahn-page-content">
        <p class="vahn-page-meta"><strong>Last updated:</strong> 02.09.2026</p>

        <h2>1. Shipping Policy</h2>
        <p>We currently ship across India.</p>

        <h3>Order Processing</h3>
        <p>Orders are processed on business days (Monday to Saturday, excluding public holidays). Orders are dispatched within 2 business days of payment confirmation.</p>
        <p>During a product drop or sale period, dispatch may take up to 4 business days, and we will note this on the product page.</p>

        <h3>Delivery Timelines</h3>
        <p>Once dispatched, estimated delivery is:</p>
        <ul>
          <li><strong>Metro cities:</strong> 3–5 business days</li>
          <li><strong>Rest of India:</strong> 5–8 business days</li>
        </ul>
        <p>These are estimates provided by BlueDart, Delhivery and XpressBees which are reliable third-party vendors, and are not guaranteed. Delays caused by weather, strikes, public holidays, or regional restrictions are outside our control.</p>

        <h3>Tracking</h3>
        <p>You will receive a tracking link by email and SMS once your order is dispatched. Tracking information may take up to 24 hours to become active.</p>

        <h3>Address Accuracy</h3>
        <p>Please check your shipping address and phone number carefully before completing your order. We are unable to change the delivery address once an order is dispatched. Orders returned to us because of an incorrect or incomplete address, or repeated failed delivery attempts, will be refunded less the shipping cost incurred, or can be re-shipped at your cost.</p>

        <h3>Failed Delivery</h3>
        <p>The courier partners will make 3 delivery attempts. If delivery fails after these attempts, the package returns to us and we will contact you to arrange a refund or re-shipment.</p>

        <h3>Damaged in Transit</h3>
        <p>If your package arrives visibly damaged or tampered with, please refuse delivery where possible and email us at <a href="mailto:support@vahnsports.com">support@vahnsports.com</a> within 48 hours with photographs. We will replace or refund the order.</p>

        <hr style="margin: 36px 0; border: none; border-top: 1px solid var(--color-border);" />

        <h2>2. Returns, Refunds & Exchange Policy</h2>

        <h3>Return Window</h3>
        <p>You may request a return or exchange within <strong>10 days</strong> of delivery.</p>

        <h3>Condition of the Product</h3>
        <p>Returned items must be unworn, unwashed, and undamaged, with all original tags, labels, and packaging intact. Items showing signs of wear, washing, alteration, odour, or stains cannot be accepted.</p>

        <h3>How to Request a Return</h3>
        <p>Email <a href="mailto:support@vahnsports.com">support@vahnsports.com</a> with your order number, the item you wish to return, and the reason. For damaged or incorrect items, please attach photographs. We will confirm your request within 48 hours and arrange the next step.</p>

        <h3>Return Shipping</h3>
        <p>We arrange a free reverse pickup at your registered address. Where reverse pickup is unavailable at your pin code, you may self-ship the item to our address, and we will reimburse the shipping amount towards courier cost on approval of the return.</p>
        <p>If the item you received was damaged, defective, or not what you ordered, return shipping is free in all cases.</p>

        <h3>Refunds</h3>
        <p>Once we receive and inspect your return, we will notify you of the outcome. Approved refunds are processed within 7 business days to your original payment method. Depending on your bank or payment provider, the amount may take a further 3–7 business days to reflect in your account.</p>
        <p>Shipping charges paid on the original order are non-refundable, except where the return is due to a damaged, defective, or incorrect item.</p>

        <h3>Exchanges</h3>
        <p>Size exchanges are subject to availability. Because our drops are produced in limited runs, we cannot guarantee that your preferred size will be in stock. If it is not, we will process a refund instead.</p>

        <h3>Non-Returnable Items</h3>
        <p>Items marked "final sale" on the product page, and items purchased with a discount above 50%, are not eligible for return or exchange, except where damaged or defective.</p>

        <h3>Damaged or Incorrect Items</h3>
        <p>Please report any damage, defect, or incorrect item within 48 hours of delivery, with photographs, at <a href="mailto:support@vahnsports.com">support@vahnsports.com</a>. We will arrange a replacement or full refund, including shipping, at no cost to you.</p>

        <hr style="margin: 36px 0; border: none; border-top: 1px solid var(--color-border);" />

        <h2>3. Cancellation Policy</h2>

        <h3>Cancelling Your Order</h3>
        <p>You may cancel your order at any time before it is dispatched. Email <a href="mailto:support@vahnsports.com">support@vahnsports.com</a> with your order number as soon as possible. Once an order is dispatched, it cannot be cancelled, but you may return it under our Returns, Refunds & Exchange Policy.</p>

        <h3>Refunds on Cancellation</h3>
        <p>Orders cancelled before dispatch are refunded in full, including shipping, within 7 business days to the original payment method.</p>

        <h3>Cancellation by Us</h3>
        <p>We may cancel an order where the item is out of stock, where a pricing or listing error has occurred, where the delivery address falls outside our serviceable area, or where we suspect fraudulent activity. We will inform you by email and refund the full amount.</p>
      </div>
    `,
  },

  'about': {
    id: 'page-about',
    handle: 'about',
    title: 'Our Story',
    bodySummary: 'The story and philosophy of VAHN — Indian sport-lifestyle apparel.',
    seo: {
      title: 'Our Story | VAHN',
      description: "Sport isn't something you do. It's how you see. Learn the story behind VAHN.",
    },
    body: `
      <div class="vahn-page-content vahn-story-content">
        <p class="vahn-story-quote" style="font-family: var(--font-heading); font-size: clamp(1.25rem, 2.5vw, 1.75rem); font-weight: 700; text-transform: uppercase; letter-spacing: -0.025em; line-height: 1.25; margin-bottom: 32px; color: var(--color-black);">
          SPORTS ISN'T SOMETHING YOU DO. IT'S HOW YOU SEE.
        </p>

        <h3>What is VAHN</h3>
        <p>VAHN is an Indian sport-lifestyle brand for people who play any sport and care how they look while playing.</p>
        <p>Most sportswear here assumes you're training for something. That you're on a programme, chasing a number, becoming a better version of yourself. We're not built on that. We're built on the part that came before all of it, the part where you played because you wanted to, until it got dark, and then argued about it on the walk home.</p>
        <p>Sport isn't something you do. It's how you see. It decides your week, your friendships, your mood on a Monday. That deserves to be dressed properly.</p>

        <h3>The Name</h3>
        <p>VAHN comes from <em>vāhana</em>, Sanskrit for the vehicle, the thing that carries. In the old stories the vāhana is never the god. It's what the god rides.</p>
        <p>That felt right for a sports-lifestyle brand. What you wear isn't the point. It's what gets you to the ground, through the match, and home again.</p>

        <h3>The Gap</h3>
        <p>India has never had a shortage of people who play. It has a shortage of kit made for them. The global brands arrive with campaigns built somewhere else and translated badly. The homegrown ones sell gym culture, grind, transformation, before and after. Neither is about the Sunday match, the Wednesday court, or the group chat that decides the fixture.</p>

        <h3>How We Build</h3>
        <p>Every fabric is chosen for the conditions it'll actually meet, the heat, the monsoon, the wash it gets that night because you're playing again tomorrow. Every cut is tested on the body it's for, moving the way that body moves. Panelling goes where the heat collects, not where it looks good on a flat lay. Stitching is built to be pulled at. Marks and detailing are made to still be there in a year, not just on the first wear.</p>
        <p>Some of these decisions take weeks and none of them are visible from across a room. That's the point.</p>

        <div style="margin-top: 48px; padding: 32px; background: var(--color-grey-light); border-left: 3px solid #4232d9;">
          <h4 style="font-family: var(--font-heading); text-transform: uppercase; font-size: 0.875rem; letter-spacing: 0.08em; margin-bottom: 16px;">FOUNDER'S NOTE</h4>
          <p style="font-family: 'Lora', Georgia, serif; font-size: 1rem; line-height: 1.7; color: var(--color-black); margin-bottom: 16px;">
            I grew up playing until the light went. Every afternoon until sunset, however long that happened to be, cricket on cracked concrete, football on a field that flooded every monsoon and never quite drained. Mostly with my brother and four of his friends, all older than me, which meant I spent years being the worst player on the ground.
          </p>
          <p style="font-family: 'Lora', Georgia, serif; font-size: 1rem; line-height: 1.7; color: var(--color-black); margin-bottom: 16px;">
            I'm a designer by trade, so somewhere along the way I started looking at what we were all wearing. Kit made for a body somewhere else, or made for a gym none of us went to. Everything was translated or borrowed. Nothing was made by anyone who had been on that ground.
          </p>
          <p style="font-family: 'Lora', Georgia, serif; font-size: 1rem; line-height: 1.7; color: var(--color-black); margin-bottom: 16px;">
            VAHN is my attempt at the thing I wanted and couldn't buy. I design all of it — the jerseys, the box, the type you're reading now. Two friends build it with me, and all three of us play.
          </p>
          <p style="font-family: 'Lora', Georgia, serif; font-size: 1rem; line-height: 1.7; color: var(--color-black); margin-bottom: 16px;">
            We'll get things wrong. The fit and the fabric won't be among them.
          </p>
          <p style="font-weight: 700; margin-bottom: 0;">— Abhinandan</p>
        </div>
      </div>
    `,
  },

  'contact': {
    id: 'page-contact',
    handle: 'contact',
    title: 'Contact Us',
    bodySummary: 'Get in touch with the VAHN team.',
    seo: {
      title: 'Contact Us | VAHN',
      description: 'Customer support, business inquiries, and bespoke teamwear enquiries.',
    },
    body: `
      <div class="vahn-page-content">
        <p>We read every message.</p>
        <p><strong>Email:</strong> <a href="mailto:support@vahnsports.com">support@vahnsports.com</a><br/>
        <strong>Phone:</strong> +91 8013340567<br/>
        <strong>Support Hours:</strong> Monday to Saturday, 10:00 AM – 6:00 PM IST</p>
        <p>For order-related queries, please include your order number. We aim to respond to all emails within 24 hours on business days.</p>
      </div>
    `,
  },
};

// Aliases for user-friendly and backwards-compatible routing
STATIC_PAGES['our-story'] = STATIC_PAGES['about'];
STATIC_PAGES['privacy'] = STATIC_PAGES['privacy-policy'];
STATIC_PAGES['terms'] = STATIC_PAGES['terms-and-conditions'];
STATIC_PAGES['terms-of-service'] = STATIC_PAGES['terms-and-conditions'];
STATIC_PAGES['shipping-policy'] = STATIC_PAGES['shipping'];
STATIC_PAGES['returns'] = STATIC_PAGES['shipping'];
STATIC_PAGES['contact-us'] = STATIC_PAGES['contact'];
