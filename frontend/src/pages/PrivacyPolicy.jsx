import React from "react";

export default function PrivacyPolicy() {
    return (
        <div className="max-w-[1000px] mx-auto px-6 lg:px-10 py-16">
            <div className="overline text-[var(--gold)]">
                Legal
            </div>

            <h1 className="font-serif-display text-4xl md:text-5xl text-[var(--navy)] mt-3">
                Privacy Policy
            </h1>

            <p className="mt-4 text-sm text-slate-500">
                Last updated: {new Date().toLocaleDateString("en-IN")}
            </p>

            <div className="mt-10 space-y-8 text-slate-700 leading-relaxed">

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        1. Introduction
                    </h2>
                    <p className="mt-3">
                        Elegant Home Advisors ("we", "us", or "our") respects your
                        privacy and is committed to protecting the personal information
                        you provide while using our website and real estate advisory
                        services.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        2. Information We Collect
                    </h2>
                    <p className="mt-3">
                        We may collect information that you voluntarily provide through
                        enquiry forms, contact forms, property enquiries, or other
                        interactions with our website.
                    </p>

                    <ul className="mt-3 list-disc pl-6 space-y-2">
                        <li>Name</li>
                        <li>Phone number</li>
                        <li>Email address</li>
                        <li>Property preferences and enquiry details</li>
                        <li>Any other information you voluntarily submit</li>
                    </ul>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        3. How We Use Your Information
                    </h2>
                    <p className="mt-3">
                        Information submitted through our website may be used to:
                    </p>

                    <ul className="mt-3 list-disc pl-6 space-y-2">
                        <li>Respond to property enquiries</li>
                        <li>Provide information about properties and services</li>
                        <li>Contact you regarding your enquiry</li>
                        <li>Improve our website and services</li>
                        <li>Maintain records of enquiries and communications</li>
                    </ul>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        4. Cookies
                    </h2>
                    <p className="mt-3">
                        Our website may use cookies and similar technologies to improve
                        website functionality, understand website usage, and provide a
                        better browsing experience.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        5. Third-Party Services
                    </h2>
                    <p className="mt-3">
                        Our website may contain links to or integrations with third-party
                        services such as Google Maps, YouTube, WhatsApp, social media
                        platforms, analytics services, or other service providers.
                        These services may have their own privacy policies and terms.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        6. Data Security
                    </h2>
                    <p className="mt-3">
                        We take reasonable measures to protect information submitted
                        through our website. However, no method of transmission or
                        electronic storage can be guaranteed to be completely secure.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        7. Data Sharing
                    </h2>
                    <p className="mt-3">
                        We do not intend to sell personal information submitted through
                        our website. Information may be shared with relevant service
                        providers or property partners where reasonably necessary to
                        respond to your enquiry or provide requested services.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        8. Your Choices
                    </h2>
                    <p className="mt-3">
                        You may contact us to request information about the personal
                        information we hold about you or to request correction or
                        deletion where applicable.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        9. Changes to This Privacy Policy
                    </h2>
                    <p className="mt-3">
                        We may update this Privacy Policy from time to time. Any changes
                        will be reflected on this page with an updated revision date.
                    </p>
                </section>

                <section>
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">
                        10. Contact Us
                    </h2>
                    <p className="mt-3">
                        If you have questions about this Privacy Policy or how your
                        information is handled, please contact Elegant Home Advisors
                        through the contact details provided on our website.
                    </p>
                </section>

            </div>
        </div>
    );
}
