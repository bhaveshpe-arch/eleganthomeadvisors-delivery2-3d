/**
 * Pages about properties never show the advisor's phone, email or WhatsApp. Visitors get them in a pop-up
 * after they send a site-visit request or an enquiry. Change this pattern to control where the details are hidden.
 */
export const isPropertyRoute = (pathname) => /^\/(propert(y|ies)|compare|shortlist)/.test(pathname || "");
