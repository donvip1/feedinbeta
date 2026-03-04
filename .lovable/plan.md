

## Plan: Fix Google Safe Browsing Phishing False Positive

### Problem
Google Safe Browsing is flagging the login page as "Possible Phishing" because the credential inputs (email/password) are not wrapped in a proper `<form>` element. Google's crawler sees password fields without standard form structure and flags it as suspicious — especially on shared subdomains like `*.lovable.app`.

### Changes

#### 1. Wrap SignInForm inputs in a proper `<form>` element (`SignInForm.tsx`)
- Replace the outer `<div className="space-y-5">` with a `<form>` element
- Add `method="post"` and `action="#"` attributes (signals legitimacy to crawlers)
- Use `onSubmit` instead of button `onClick` for the sign-in action
- Prevents the "credential fields without a form" heuristic from triggering

#### 2. Wrap SignUpForm inputs in a proper `<form>` element (`SignUpForm.tsx`)
- Same treatment — wrap in `<form>` with proper attributes
- Use `onSubmit` for form submission

#### 3. Add site ownership meta tags to `index.html`
- Ensure `<meta name="author">` and proper canonical URL `<link rel="canonical">` point to `feedinn.com`
- This helps Google associate the login page with a legitimate owned domain

### After Deploy
You will need to:
1. Go to [Google Search Console](https://search.google.com/search-console) for `feedinn.com`
2. Navigate to **Security & Manual Actions → Security Issues**
3. Click **"Request a Review"** after publishing these changes
4. Google typically resolves reviews within 72 hours

