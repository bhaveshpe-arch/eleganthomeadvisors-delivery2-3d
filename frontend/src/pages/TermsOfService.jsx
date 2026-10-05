import React from "react";

export default function TermsOfService() {
    return (
        <div className="max-w-[1000px] mx-auto px-6 lg:px-10 py-16">
            <div className="overline text-[var(--gold)]">
                Legal
            </div>

            <h1 className="font-serif-display text-4xl md:text-5xl text-[var(--navy)] mt-3">
                Terms of Service
            </h1>

            <p className="mt-4 text-sm text-slate-500">
                Last updated: {new Date().toLocaleDateString("en-IN")}
            </p>

            <div className="mt-10 space-y-8 text-slate-700 leading-relaxed">

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        1. Acceptance of Terms
                    </h2>
                    <p className="mt-3">
                        By accessing or using the Elegant Home Advisors website, you
                        agree to comply with these Terms of Service. If you do not agree
                        with these terms, please do not use the website.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        2. About Our Services
                    </h2>
                    <p className="mt-3">
                        Elegant Home Advisors provides real estate advisory and property
                        information services. Property information displayed on the
                        website is provided for general informational purposes and may
                        change without notice.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        3. Property Information
                    </h2>
                    <p className="mt-3">
                        Property prices, availability, configurations, specifications,
                        possession dates, images, amenities and other details may be
                        subject to change. Users should independently verify all
                        property information before making any investment or purchase
                        decision.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        4. No Guarantee of Availability
                    </h2>
                    <p className="mt-3">
                        Listing a property on this website does not guarantee that the
                        property remains available for purchase, booking, or
                        inspection. Availability should be confirmed directly with the
                        relevant developer, seller, or authorised representative.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        5. User Enquiries
                    </h2>
                    <p className="mt-3">
                        When you submit an enquiry, you agree that Elegant Home Advisors
                        may contact you using the information provided for the purpose
                        of responding to your enquiry and providing relevant property
                        information.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        6. Intellectual Property
                    </h2>
                    <p className="mt-3">
                        Unless otherwise stated, the website design, text, graphics,
                        logos, branding and original content are owned by or licensed
                        to Elegant Home Advisors and may not be reproduced without
                        permission.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        7. Third-Party Links
                    </h2>
                    <p className="mt-3">
                        The website may contain links or embedded content from
                        third-party websites and services. Elegant Home Advisors is
                        not responsible for the content, availability, or policies of
                        third-party websites.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        8. Limitation of Liability
                    </h2>
                    <p className="mt-3">
                        To the extent permitted by applicable law, Elegant Home Advisors
                        shall not be responsible for losses arising from reliance on
                        information displayed on the website, including changes to
                        property prices, availability, specifications, or other
                        property-related information.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        9. Changes to These Terms
                    </h2>
                    <p className="mt-3">
                        We may update these Terms of Service from time to time. Updated
                        terms will be published on this page.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        10. Contact
                    </h2>
                    <p className="mt-3">
                        If you have questions regarding these Terms of Service, please
                        contact Elegant Home Advisors through the contact details
                        available on the website.
                    </p>
                </section>

            </div>
        </div>
    );
}
