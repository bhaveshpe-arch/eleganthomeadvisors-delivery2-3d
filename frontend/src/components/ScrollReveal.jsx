import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollReveal component that uses IntersectionObserver to reveal elements
 * with luxury fluid animations (.reveal, .reveal-left, .reveal-right, .reveal-scale)
 * as they scroll into view.
 */
export default function ScrollReveal() {
    const location = useLocation();

    useEffect(() => {
        // Create an observer for all reveal targets
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                    }
                });
            },
            {
                threshold: 0.12,
                rootMargin: "0px 0px -40px 0px",
            }
        );

        // Helper to attach observer to unobserved reveal elements
        const attachObserver = () => {
            const elements = document.querySelectorAll(
                ".reveal:not(.is-visible), .reveal-left:not(.is-visible), .reveal-right:not(.is-visible), .reveal-scale:not(.is-visible), .reveal-stagger:not(.is-visible)"
            );
            elements.forEach((el) => observer.observe(el));
        };

        // Attach immediately and after slight delay for async loaded content
        attachObserver();
        const timer = setTimeout(attachObserver, 300);

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [location.pathname, location.search]);

    return null;
}
