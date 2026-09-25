/* ============================================================
   Mathub — Terms of Use, Community Rules, Privacy Policy, Disclaimer
   Rendered at #/policy (standalone) or #/<course>/policy.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, esc, icon, bind, pageHead } = App;
  const EFFECTIVE = 'September 18, 2026';
  const OP = () => App.CREATOR || { name: 'Nikoloz Nonikashvili', email: 'nonikashvilinikolozi@gmail.com' };

  function html() {
    const op = OP();
    return `<div class="policy">
      <div class="policy-nav">${[['terms', 'Terms of Use'], ['rules', 'Community Rules'], ['privacy', 'Privacy Policy'], ['disclaimer', 'Disclaimer'], ['contact', 'Contact']].map(([id, l]) => `<a class="btn sm" href="#" data-action="jump" data-t="${id}">${l}</a>`).join('')}</div>
      <div class="callout small"><b>Plain-language summary.</b> Mathub is a free study site made by a student. You may use it if you follow the rules. What you post is yours and your responsibility. We do not sell your data. Illegal activity, harassment and cheating are not allowed, get removed, and can get you banned. Mathub is provided as is, without guarantees. Effective ${EFFECTIVE}.</div>

      <h2 id="pol-terms">1. Terms of Use</h2>
      <p>These Terms of Use (“Terms”) govern your use of the Mathub website, including its study tools and the Discussions board (together, the “Service”). The Service is operated by ${esc(op.name)}, an individual student (“Mathub”, “we”, “us”). By creating an account or using the Service you agree to these Terms, the Community Rules and the Privacy Policy below. If you do not agree, do not use the Service.</p>
      <h3>1.1 Who may use Mathub</h3>
      <p>Accounts are available to people with a valid montana.edu email address. You must be at least 18 years old, or at least 13 with the consent of a parent or guardian, to create an account. You are responsible for keeping your password confidential and for everything that happens under your account.</p>
      <h3>1.2 Your content</h3>
      <p>“User Content” means anything you post, upload or share through the Service, including posts, comments, titles and your display name. You keep ownership of your User Content. You grant Mathub a non-exclusive, royalty-free, worldwide license to store, display, reproduce, adapt (for example, to censor prohibited words or to format text) and distribute your User Content solely for the purpose of operating and improving the Service. This license ends when you delete the content or your account, except for copies that remain in backups for a limited time or that other users have already quoted.</p>
      <p><b>You are solely responsible for your User Content.</b> You represent that you have the right to post it, that it is accurate to the best of your knowledge, and that it does not break these Terms or any law.</p>
      <h3>1.3 Prohibited conduct</h3>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Offer, sell, buy, trade, seek or promote illegal drugs, controlled substances, alcohol to minors, weapons, stolen goods, counterfeit items, or any other illegal goods or services, or arrange any illegal activity;</li>
        <li>Harass, threaten, bully, stalk, defame or intimidate anyone, or post hateful content that attacks people based on race, ethnicity, national origin, religion, sex, gender identity, sexual orientation, disability or similar characteristics;</li>
        <li>Post sexual content, content involving minors in a sexual way, or content that promotes self-harm or violence;</li>
        <li>Share exam questions or answers during an exam, submit others’ work as your own, or otherwise help anyone violate a course policy or the Montana State University academic integrity policy;</li>
        <li>Post other people’s private information (addresses, phone numbers, grades, photos) without their permission, or impersonate any person or organization;</li>
        <li>Post spam, advertising, malware, links to harmful sites, or content you do not have the right to share (for example, copyrighted textbook chapters);</li>
        <li>Interfere with the Service, try to access other users’ accounts or data, scrape the site, or bypass the language filter, rate limits or moderation.</li>
      </ul>
      <h3>1.4 Moderation and removal</h3>
      <p>Mathub is an interactive computer service that hosts content written by its users. We do not review content before it is posted and we have no obligation to monitor it, but we may (through moderators or automated filters) remove, edit, hide or refuse any content at any time and for any reason, including content we believe violates these Terms, is illegal, or could expose Mathub or anyone else to harm or liability. We may also suspend or terminate accounts, temporarily or permanently, with or without notice. We may report illegal activity to Montana State University and to law enforcement, and may preserve and share related account data as described in the Privacy Policy.</p>
      <h3>1.5 No liability for user content</h3>
      <p>Content on the Discussions board reflects the views of the person who posted it, not of Mathub. To the fullest extent permitted by law, including 47 U.S.C. § 230, Mathub is not the publisher or speaker of User Content and is not responsible or liable for any User Content, for any illegal or harmful activity that users attempt to conduct through the Service, or for any transaction, meeting or communication between users. If you see something that breaks the rules, use the Report button or contact us; we will act in good faith on reports we receive.</p>
      <h3>1.6 Study content is not official</h3>
      <p>Notes, calendars, practice problems, generated quiz questions, grade calculations and every other study aid on Mathub are prepared by students and may contain errors. They are not produced, reviewed or endorsed by Montana State University or by any instructor. Your syllabus, Canvas and your instructor are the only authoritative sources for dates, policies and grades.</p>
      <h3>1.7 Disclaimer of warranties</h3>
      <p>THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE”, WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, NON-INFRINGEMENT AND UNINTERRUPTED OR ERROR-FREE OPERATION. We do not guarantee that saved progress will never be lost. Keep your own copies of anything important.</p>
      <h3>1.8 Limitation of liability</h3>
      <p>TO THE FULLEST EXTENT PERMITTED BY LAW, MATHUB AND ITS OPERATOR WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF DATA, GRADES, OPPORTUNITIES OR GOODWILL, ARISING OUT OF OR RELATED TO THE SERVICE OR ANY USER CONTENT, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. THE TOTAL LIABILITY OF MATHUB FOR ANY CLAIM RELATED TO THE SERVICE WILL NOT EXCEED TEN U.S. DOLLARS (US $10). Some jurisdictions do not allow certain limitations, so some of these may not apply to you.</p>
      <h3>1.9 Indemnification</h3>
      <p>You agree to defend, indemnify and hold harmless Mathub and its operator from any claims, damages, losses and expenses (including reasonable attorney fees) arising out of your User Content, your use of the Service, or your violation of these Terms or of any law or third-party right.</p>
      <h3>1.10 Termination</h3>
      <p>You can stop using the Service at any time and delete your account from Settings. We may suspend or terminate your access at any time, for example for violating these Terms. Sections 1.2 (license, to the extent stated), 1.5, 1.7, 1.8, 1.9 and 1.11 survive termination.</p>
      <h3>1.11 General</h3>
      <p>These Terms are governed by the laws of the State of Montana, USA, without regard to conflict-of-law rules, and any dispute will be brought in the state or federal courts located in Montana. If any part of these Terms is found unenforceable, the rest remains in effect. We may update these Terms; the effective date at the top changes when we do, and continued use after a change means you accept it. These Terms are the entire agreement between you and Mathub about the Service.</p>

      <h2 id="pol-rules">2. Community Rules</h2>
      <p>Short version of what every member agrees to before posting on Discussions:</p>
      <ol>
        <li><b>Be decent.</b> Disagree with ideas, not people. No harassment, hate, threats or targeting of individual students or instructors.</li>
        <li><b>Nothing illegal.</b> No selling or seeking drugs, alcohol, weapons, stolen items, fake IDs or anything else against the law. These posts are removed, the account is banned, and the post may be reported to the university or police.</li>
        <li><b>Academic honesty.</b> Help each other understand the material. Do not share exam questions or answers during an exam window, and do not ask others to do your graded work.</li>
        <li><b>Respect privacy.</b> Do not post other people’s personal information or private messages.</li>
        <li><b>Keep it useful.</b> No spam, advertising or off-topic flooding. Use the right class and post type.</li>
        <li><b>Language filter.</b> Curse words and slurs are censored automatically. Trying to dodge the filter counts as breaking this rule.</li>
        <li><b>Moderators decide.</b> Moderators can remove content, lock or pin posts and pause accounts. Repeated or serious violations mean a permanent ban.</li>
      </ol>
      <p>Anonymous posting hides your name from other students, not from moderators.</p>

      <h2 id="pol-privacy">3. Privacy Policy</h2>
      <p>This policy explains what Mathub collects and how it is used. We collect as little as we can to run the Service.</p>
      <h3>3.1 What we collect</h3>
      <ul>
        <li><b>Account data:</b> your email address, an optional display name, a hashed version of your password (we never store the password itself), and the dates you signed up, verified your email, logged in and accepted these Terms.</li>
        <li><b>Study progress:</b> quiz history and accuracy, flashcard boxes, checklist ticks, grade entries you type into the calculator and scratchpad strokes. This is saved to your account so it follows you across devices.</li>
        <li><b>Discussions:</b> posts, comments, votes, reports and edits you make, including the “anonymous” flag. Anonymous posts still record which account made them.</li>
        <li><b>Technical data:</b> your IP address and browser type when you sign up, log in, post or comment (kept to prevent abuse, enforce bans and rate limits, and investigate reports), and a session cookie that keeps you logged in.</li>
        <li><b>Local data:</b> preferences (theme, as-of date), a copy of your progress, and unsent drafts are stored in your browser’s local storage on each device you use.</li>
      </ul>
      <h3>3.2 How we use it</h3>
      <p>To operate the Service (log you in, sync progress, show your posts), to send the emails you request (verification and password-reset codes), to keep the community safe (moderation, bans, abuse prevention) and to fix bugs. We do not use your data for advertising and we do not sell or rent it to anyone.</p>
      <h3>3.3 Who can see what</h3>
      <ul>
        <li>Other members see your display name (or the part of your email before the @ if you have not set one) next to your posts, unless you post anonymously. Visitors who are not logged in see only post titles.</li>
        <li>Moderators can see the author of every post and comment, including anonymous ones, and the report queue.</li>
        <li>Service providers: the site and its database are hosted by Hostinger; emails are sent through Hostinger’s mail servers; fonts are loaded from Google Fonts and the math renderer (MathJax) from the jsDelivr CDN. Those providers receive your IP address when your browser loads their resources.</li>
        <li>Legal: we may disclose account data if required by law, subpoena or court order, to enforce these Terms, to report suspected illegal activity, or to protect the safety of any person.</li>
      </ul>
      <h3>3.4 Retention and deletion</h3>
      <p>Your data is kept while your account exists. Deleting your account from Settings permanently deletes your account record, progress, votes and reports. Posts and comments you deleted earlier are hidden from members; moderators may keep removed content, and short-lived backups may persist, for up to 90 days for abuse investigations. Verification codes expire within minutes and are deleted when used.</p>
      <h3>3.5 Your choices</h3>
      <p>You can edit or delete your posts and comments, change your display name, post anonymously, export a backup of your progress, or delete your whole account, all from within the Service. Email us for anything you cannot do yourself.</p>
      <h3>3.6 Security</h3>
      <p>Passwords are stored as one-way hashes, logins use secure cookies over HTTPS, and the account database is not accessible from the web. No system is perfectly secure; use a password you do not use elsewhere and tell us if you suspect a problem.</p>
      <h3>3.7 Children</h3>
      <p>The Service is intended for university students and is not directed at children under 13. We do not knowingly collect data from children under 13; if you believe we have, contact us and we will delete it.</p>
      <h3>3.8 Changes</h3>
      <p>If this policy changes in a meaningful way we will update the effective date and note the change on the site.</p>

      <h2 id="pol-disclaimer">4. Disclaimer</h2>
      <p>Mathub is an independent student project. It is <b>not affiliated with, endorsed by or operated by Montana State University</b>, its Department of Mathematical Sciences, its Department of Physics, or any instructor. Course names and dates are referenced only to help students organize their own studying. Discussions are written by students and are not moderated by the University. Nothing on this site is professional, legal, medical or academic advice.</p>

      <h2 id="pol-contact">5. Contact</h2>
      <p>Questions about these Terms, the Privacy Policy, a report, or a request to delete data: ${esc(op.name)} · <a href="mailto:${esc(op.email)}">${esc(op.email)}</a> · <a href="#/contact">contact page</a>.</p>
      <p class="small muted">Effective ${EFFECTIVE}.</p>
    </div>`;
  }

  App.views.policy = {
    title: 'Terms & Privacy',
    render(root, param, query, standalone) {
      const inner = html();
      root.innerHTML = standalone
        ? `<div class="landing-wrap policy-wrap"><header class="landing-top"><div><div class="eyebrow">Mathub</div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>Terms &amp; Privacy</h1><p class="muted">Terms of Use, Community Rules, Privacy Policy and Disclaimer for Mathub.</p></div><div class="row gap-sm"><a class="btn" href="#/">${icon('left', 14)} All classes</a><button class="icon-btn theme-btn" data-action="theme" aria-label="Toggle theme"></button></div></header><div class="panel">${inner}</div></div>`
        : pageHead('Terms & Privacy', 'Terms of Use, Community Rules, Privacy Policy and Disclaimer for Mathub.') + `<div class="panel">${inner}</div>`;
      bind(root, { jump: (el, e) => { e.preventDefault(); const t = $('#pol-' + el.dataset.t, root); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, theme: () => App.toggleTheme() });
      if (param) { const t = $('#pol-' + param, root); if (t) setTimeout(() => t.scrollIntoView({ block: 'start' }), 50); }
    }
  };
})(window);
