# Admin Panel Login Page — Professional Redesign

## TL;DR
> **Quick Summary**: Redesign admin panel login page with modern, presentable UI. Replace Vite template CSS with professional styling.
> 
> **Deliverables**:
> - Professional login page with branding section + form
> - Clean admin panel CSS (replace Vite boilerplate)
> - Error states, loading, form validation
> 
> **Estimated Effort**: Quick (30 min)
> **Parallel Execution**: NO — 3 sequential tasks
> **Critical Path**: CSS → Login page → Verify

---

## Context

### Original Request
User wants a presentable admin panel login page. Everything runs locally on laptop, not connected to bot yet. This is the first impression for client demos.

### Current State
- `admin-panel/src/pages/Login.tsx` exists but uses basic inline styles, looks minimal
- `admin-panel/src/index.css` is Vite template (desktop width, dark mode, Vite logos)
- `admin-panel/src/App.tsx` routes: `/login` → LoginPage, `/` → TestsManagement (protected)
- Backend at `localhost:8000` with admin auth (`admin`/`admin123`)

### Scope Boundaries
- IN: Redesign Login.tsx + index.css, professional look
- OUT: Dashboard/management pages, auth flow changes, bot integration

---

## Work Objectives

### Core Objective
Replace current basic login page with a modern, client-presentable design.

### Concrete Deliverables
- `admin-panel/src/index.css` — clean admin panel CSS (no Vite template)
- `admin-panel/src/pages/Login.tsx` — redesigned professional login page
- `admin-panel/src/pages/Login.module.css` — scoped login page styles

### Must Have
- Professional branding area (logo, tagline)
- Clean form with labeled inputs
- Loading state on submit
- Error message display (wrong credentials)
- Form validation (empty fields)
- Responsive design

### Must NOT Have
- Vite template CSS (dark mode, width:1126px, hero/vite elements)
- Complex animations/transitions
- Multi-step auth (2FA)
- Registration/forgot password (not in scope)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (admin-panel has no tests)
- **Automated tests**: None
- **Agent-Executed QA**: ALWAYS

### QA Policy
- Frontend: Playwright opens browser, fills form, asserts UI elements, captures screenshot
- Evidence saved to `.sisyphus/evidence/`

---

## Execution Strategy

```
Wave 1 (sequential — foundation first):
├── Task 1: Replace index.css with professional admin panel CSS [quick]
└── Task 2: Redesign Login.tsx with modern split layout [visual-engineering]

Wave FINAL:
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high + playwright)
└── Task F4: Scope fidelity check (deep)
```

---

## TODOs

- [ ] 1. Replace admin-panel CSS with professional styling

  **What to do**:
  - Replace `admin-panel/src/index.css` — remove all Vite template CSS
  - Add CSS variables: `--primary: #4f46e5`, `--bg: #f8fafc`, `--text: #1e293b`, etc.
  - Set `html, body` to `height: 100%`, `background: var(--bg)`
  - Set `#root` to `min-height: 100vh`
  - Add form input focus styles with shadow ring
  - Clean global resets: `box-sizing: border-box`, `margin: 0`
  - Font: Inter / system font stack

  **Must NOT do**:
  - Keep any Vite template code (dark mode `#16171d`, `width:1126px`, `.hero`, `.counter`, Vite references)
  - Add page-specific styles — only global resets and variables

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file CSS replacement, straightforward
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `vercel-react-best-practices`: CSS-only task, no React rendering

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 — sequential dependency
  - **Blocks**: Task 2 (Login page needs the CSS variables)
  - **Blocked By**: None (can start immediately)

  **References**:
  - Existing CSS to check what to remove: `admin-panel/src/index.css:1-111` — Vite template code to replace
  - Mini App CSS for pattern reference: `mini-app/src/index.css` — similar cleanup already done

  **Acceptance Criteria**:
  - [ ] `admin-panel/src/index.css` contains NO Vite template classes (`.hero`, `.counter`, `#next-steps`, etc.)
  - [ ] File defines `--primary`, `--bg`, `--text`, `--border`, `--radius` CSS variables
  - [ ] No hardcoded `width:1126px` or dark mode styles

  **QA Scenarios**:
  ```
  Scenario: CSS variables are properly defined for login page use
    Tool: Bash
    Preconditions: File saved
    Steps:
      1. Read admin-panel/src/index.css
      2. Grep for `--primary:` — should exist
      3. Grep for `--bg:` — should exist
      4. Grep for Vite template patterns `\.hero` or `.counter` — should NOT exist
      5. Grep for `width: 1126px` — should NOT exist
    Expected Result: CSS variables present, no Vite template remnants
    Evidence: .sisyphus/evidence/task-1-css-check.txt

  Scenario: CSS handles form inputs properly
    Tool: Bash (grep)
    Preconditions: File saved
    Steps:
      1. Grep for `input:focus` rule — should exist with outline/border color
    Expected Result: Input focus styles present
    Evidence: .sisyphus/evidence/task-1-input-focus.txt
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `feat(admin): professional login page redesign`
  - Files: `admin-panel/src/index.css`, `admin-panel/src/pages/Login.tsx`, `admin-panel/src/pages/Login.module.css`

- [ ] 2. Build professional login page with split layout

  **What to do**:
  - Create `admin-panel/src/pages/Login.module.css` with scoped styles
  - Rewrite `admin-panel/src/pages/Login.tsx`:
    - Split layout: left side — branding (name, tagline, subtle graphic), right side — login form
    - Branding section: "Учебный центр" title, subtitle, maybe decorative element
    - Form: username + password inputs with labels, submit button
    - Inputs: full width, 12px border-radius, light border, focus ring in primary color
    - Button: full width, primary gradient background, white text, hover darken
    - Loading: show "Вход..." + spinner on button while submitting
    - Error: red card below inputs with message text
    - Empty fields: inline validation "Заполните поле" below each input
    - Responsive: on mobile (<768px), stack vertically (branding top, form bottom)
  - Keep existing auth flow (useAuth().login + navigate('/'))

  **Must NOT do**:
  - Change auth context or API client code
  - Add registration, forgot password, or other features
  - Use any external UI library (no Material UI, Ant Design, etc.)
  - Add background images that need external hosting

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI-centered task — layout, styling, form design
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Designer-turned-developer, crafts stunning UI without mockups

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 — depends on Task 1
  - **Blocks**: F1-F4 (final verification)
  - **Blocked By**: Task 1 (needs CSS variables from index.css)

  **References**:
  - Current login page: `admin-panel/src/pages/Login.tsx:1-71` — auth flow to preserve
  - Auth context: `admin-panel/src/contexts/AuthContext.tsx` — login() API
  - Backend auth endpoint: `backend/api/admin_auth.py` — POST `/admin/auth/login` with `{username, password}` → `{access_token, token_type}`
  - Pattern: `mini-app/src/index.css` — similar CSS variable approach

  **Acceptance Criteria**:
  - [ ] Login page renders with branding on left, form on right (side by side on desktop)
  - [ ] Form has username + password inputs with proper labels and placeholder
  - [ ] Empty username or password shows inline error "Заполните поле"  
  - [ ] Wrong credentials show error message below button
  - [ ] Loading state: button shows "Вход..." + spinner while submitting
  - [ ] Correct credentials (admin/admin123) redirect to "/" (TestsManagement)
  - [ ] Responsive: stacks vertically on screens <768px

  **QA Scenarios**:
  ```
  Scenario: Login page renders correctly with branding and form
    Tool: Playwright (via playwright skill)
    Preconditions: cd admin-panel && npm run dev -> http://localhost:5173
    Steps:
      1. navigate to http://localhost:5173/login
      2. Wait for page load (timeout: 10s)
      3. Check element with branding/title text "Учебный центр" is visible
      4. Check input #username-input (data-testid="username-input") is visible
      5. Check input #password-input (data-testid="password-input") is visible
      6. Check button #login-btn (data-testid="login-btn") is visible with text "Войти"
      7. Screenshot full page
    Expected Result: Branding section on left, login form on right (or stacked on mobile)
    Failure Indicators: Missing inputs, missing button, layout broken
    Evidence: .sisyphus/evidence/task-2-login-render.png

  Scenario: Empty fields show validation
    Tool: Playwright
    Preconditions: Login page loaded
    Steps:
      1. Leave username empty
      2. Leave password empty  
      3. Click #login-btn
      4. Wait 500ms
      5. Check for validation error text "Заполните поле" or "Заполните все поля"
      6. Screenshot
    Expected Result: Error message visible, no API call made
    Evidence: .sisyphus/evidence/task-2-empty-validation.png

  Scenario: Wrong credentials show error
    Tool: Playwright
    Preconditions: Login page loaded
    Steps:
      1. Type "wrong" into #username-input
      2. Type "wrong" into #password-input
      3. Click #login-btn
      4. Wait until error message appears (timeout: 5s)
      5. Assert error message contains "Неверный" or text is visible
      6. Screenshot
    Expected Result: Red error card visible
    Evidence: .sisyphus/evidence/task-2-wrong-creds.png

  Scenario: Correct credentials login and redirect
    Tool: Playwright
    Preconditions: Login page loaded, backend running on localhost:8000
    Steps:
      1. Type "admin" into #username-input
      2. Type "admin123" into #password-input
      3. Click #login-btn
      4. Wait for navigation (timeout: 10s)
      5. Assert URL is http://localhost:5173/ (not /login)
      6. Screenshot
    Expected Result: Page redirects to / (TestsManagement page)
    Evidence: .sisyphus/evidence/task-2-login-success.png
  ```

  **Commit**: YES (combined with Task 1)

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read plan end-to-end. Verify Must Have items exist, Must NOT Have items absent.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Verify CSS is clean, no Vite template remnants, proper responsive design.
  Output: `Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright`)
  Open `http://localhost:5173` (admin panel), verify login page renders.
  Test: empty fields → error, wrong credentials → error, correct → redirect.
  Screenshots to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  Verify only login page touched, no other files modified.
  Output: `Tasks [N/N compliant] | VERDICT`

---

## Commit Strategy

- **Single commit**: `feat(admin): professional login page redesign`
- Files: `admin-panel/src/index.css`, `admin-panel/src/pages/Login.tsx`, `admin-panel/src/pages/Login.module.css`

---

## Success Criteria

### Verification Commands
```bash
cd admin-panel && npm run dev   # Starts admin panel on localhost
# Open browser → http://localhost:5173/login
# Login with admin/admin123 → redirected to /tests
```

### Final Checklist
- [ ] Login page renders with branding + form
- [ ] Form validates empty fields
- [ ] Wrong credentials show error
- [ ] Correct credentials redirect to main page
- [ ] No Vite template CSS remnants
- [ ] Responsive on tablet/desktop
