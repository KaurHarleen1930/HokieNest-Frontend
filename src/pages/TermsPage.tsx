import React from "react";

const TermsPage: React.FC = () => {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-4xl px-4 py-8 lg:py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          HokieNest – Terms of Use &amp; Code of Conduct
        </h1>
        <p className="mt-2 text-sm text-slate-500">Last Updated: November 2025</p>

        <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="prose max-w-none prose-sm sm:prose-base">
            <p>
              HokieNest is a student-developed platform created for academic and
              educational purposes. By accessing or using HokieNest
              (&quot;Service&quot;), you (&quot;User&quot;) agree to follow the Terms of
              Use and Code of Conduct described below. If you do not agree with these
              terms, please discontinue use of the Service.
            </p>

            <h2>1. Purpose of the Service</h2>
            <p>HokieNest provides tools for students to:</p>
            <ul>
              <li>Browse off-campus housing listings</li>
              <li>View property details, amenities, commute data, and safety information</li>
              <li>Explore interactive maps and neighborhood visualizations</li>
              <li>Participate in roommate matching</li>
              <li>Use community features such as posts or messaging</li>
            </ul>
            <p>
              HokieNest is <strong>not</strong> a real estate broker, property manager, or
              commercial housing service. All listing and profile information is either
              user-generated or sourced from third-party providers. Accuracy,
              availability, and completeness are <strong>not guaranteed</strong>.
            </p>

            <h2>2. No Endorsement or Verification</h2>
            <p>
              Inclusion of any property, landlord, roommate profile, or community post
              does <strong>not</strong> mean that HokieNest endorses, verifies, or
              guarantees the quality, safety, legality, or accuracy of the information.
              Users should exercise their own judgment when evaluating housing options,
              neighborhoods, or potential roommates.
            </p>

            <h2>3. User Responsibilities</h2>
            <p>Users agree to:</p>
            <ul>
              <li>Provide truthful, accurate information in listings, posts, and profiles</li>
              <li>Communicate respectfully with other users</li>
              <li>Use the platform only for lawful purposes</li>
              <li>Follow community and safety guidelines</li>
              <li>Protect their login credentials</li>
              <li>Report inappropriate content or behavior when noticed</li>
            </ul>
            <p>Users must not:</p>
            <ul>
              <li>Post fraudulent, misleading, or deceptive information</li>
              <li>Harass, threaten, or bully others</li>
              <li>Use hate speech or discriminatory language</li>
              <li>Impersonate another person</li>
              <li>Upload harmful content (viruses, malware, or unsafe links)</li>
              <li>Scrape or harvest personal data from other users</li>
              <li>Share others’ private information without consent</li>
            </ul>
            <p>
              HokieNest may remove content or restrict access for violations of these
              rules.
            </p>

            <h2>4. Fair Housing and Non-Discrimination</h2>
            <p>
              Users posting rental listings must comply with the <strong>Fair Housing
              Act</strong> and applicable local housing laws.
            </p>
            <p>
              Discrimination based on race, color, religion, national origin, sex,
              familial status, or disability is strictly prohibited.
            </p>
            <p>
              Roommate-matching preferences must be stated respectfully and must not
              violate Fair Housing guidelines.
            </p>

            <h2>5. Roommate Matching &amp; Messaging Code of Conduct</h2>
            <p>To maintain a safe and respectful environment, users agree to:</p>
            <ul>
              <li>Communicate politely and honestly</li>
              <li>Respect boundaries and personal preferences</li>
              <li>Decline matches or conversations respectfully</li>
              <li>Meet in safe, public locations if choosing to meet offline</li>
            </ul>
            <p>Users must not:</p>
            <ul>
              <li>Send threatening, inappropriate, or explicit messages</li>
              <li>Pressure others into sharing personal information</li>
              <li>Misrepresent lifestyle preferences or identity</li>
            </ul>

            <h2>6. Community Board Guidelines</h2>
            <p>Posts must:</p>
            <ul>
              <li>Be respectful and constructive</li>
              <li>Be relevant to student housing or campus life</li>
              <li>Follow university and community standards</li>
            </ul>
            <p>Posts must not include:</p>
            <ul>
              <li>Spam or advertisements</li>
              <li>Illegal activity</li>
              <li>Dangerous or harmful advice</li>
              <li>Inappropriate, offensive, or hateful content</li>
              <li>Personal attacks or doxxing</li>
            </ul>

            <h2>7. Third-Party Services</h2>
            <p>
              HokieNest may integrate with third-party tools such as map services
              (Leaflet, OpenStreetMap, Google Maps, etc.), authentication systems, or
              external APIs for commute or neighborhood data. Use of these features is
              also governed by the respective third-party terms and privacy policies.
              HokieNest is not responsible for errors or inaccuracies from external
              providers.
            </p>

            <h2>8. Disclaimer</h2>
            <p>
              HokieNest is provided <strong>for educational purposes only</strong> and is
              offered <strong>&quot;as is&quot;</strong>.
            </p>
            <p>
              HokieNest and its student developers are not responsible for rental
              disputes or landlord issues, inaccurate or missing data, misuse of
              information by other users, conflicts with roommates, safety issues
              related to housing or meetups, or loss of data or interrupted service.
              Use the Service at your own discretion.
            </p>

            <h2>9. Content Removal &amp; Access Restrictions</h2>
            <p>
              HokieNest may remove user content, suspend or limit features, restrict
              user access, or disable accounts if behavior violates these Terms of Use
              &amp; Code of Conduct, threatens user safety, or disrupts the platform.
            </p>

            <h2>10. Contact</h2>
            <p>
              For questions, concerns, or reports of inappropriate behavior, please
              contact the HokieNest development team at:
            </p>
            <p>
              <strong>Email:</strong> teamofhokienest@gmail.com
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default TermsPage;
