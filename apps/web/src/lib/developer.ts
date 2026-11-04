// The developer of printclub, credited in the footer and in the structured data.
// Matches the Person entity published on https://chames.tn so search engines link the two.

const SOURCE = "printclub";

export const developer = {
	name: "Chames Eddine Dhibi",
	role: "freelance full-stack developer",
	phone: "+216 51 091 800",
	phoneHref: "tel:+21651091800",
	whatsappHref: `https://wa.me/21651091800?text=${encodeURIComponent(
		"Hi Chames, I saw printclub and would like to talk about a website.",
	)}`,
	portfolio: "https://chames.tn/",
	portfolioHref: `https://chames.tn/?utm_source=${SOURCE}&utm_medium=referral&utm_campaign=demo_credit`,
};

export const developerPerson = {
	"@type": "Person",
	"@id": "https://chames.tn/#person",
	name: developer.name,
	alternateName: ["Chames Dhibi", "Chams Dhibi"],
	jobTitle: "Software Engineer & Full-Stack Developer",
	url: "https://chames.tn",
	telephone: "+216 51091800",
	address: {
		"@type": "PostalAddress",
		addressLocality: "Gafsa",
		addressCountry: "TN",
	},
	sameAs: [
		"https://github.com/chams99",
		"https://linkedin.com/in/chamesdh",
		"https://www.upwork.com/freelancers/~01ec2dc27e0c617399",
	],
};
