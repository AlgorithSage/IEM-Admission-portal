# Design System Specification: IEM Admission Portal

> **Owner**: `@DESIGN` (UI/UX Designer)
> **Status**: APPROVED
> **Target Theme**: Professional Academic & Institutional Portal (Matching `landing page.png`)
> **Core Brand Color**: Warm Amber / Gold (`#F59E0B`)

---

## 1. Approved Brand Color Palette: Yellow, Black & Shades of White

| Color Family | Color Name | HEX Code | RGB | Role in Application |
| :--- | :--- | :--- | :--- | :--- |
| **Yellow / Gold** | **IEM Gold (Primary)** | `#F59E0B` | `(245, 158, 11)` | Primary action buttons (Apply Now, Submit, Confirm), active nav indicator, step icons |
| **Yellow / Gold** | **IEM Amber Dark** | `#D97706` | `(217, 119, 6)` | Hover states, button active states, icon badge text, view-all links |
| **Yellow / Gold** | **IEM Light Yellow** | `#FEF3C7` | `(254, 243, 199)`| Soft icon badge circular/rounded containers, chip backgrounds |
| **Black / Dark** | **Deep Black (Text)** | `#111827` | `(17, 24, 39)` | High-contrast page headings, card titles, hero title |
| **Black / Dark** | **Dark Charcoal** | `#18181B` | `(24, 24, 27)` | Dark buttons, navbar brand title, admin role containers, footer |
| **Black / Dark** | **Muted Charcoal** | `#4B5563` | `(75, 85, 99)` | Readable subtitle text, card body descriptions |
| **Shades of White** | **Pure Surface White**| `#FFFFFF` | `(255, 255, 255)`| Program cards, feature cards, modal boxes, input fields |
| **Shades of White** | **Warm Ivory Canvas** | `#FAF8F5` | `(250, 248, 245)`| Main portal background canvas |
| **Shades of White** | **Subtle Off-White** | `#FCFBF9` | `(252, 251, 249)`| Step cards, callout cards |
| **Shades of White** | **Neutral Border** | `#E5E7EB` | `(229, 231, 235)`| Crisp card outlines, table borders, dividers |

---

## 2. Status Badge Palette

| Application Status | Badge Background | Badge Text | Meaning |
| :--- | :--- | :--- | :--- |
| **Submitted** | `#DBEAFE` (Blue 100) | `#1E40AF` (Blue 800) | Application received; awaiting scrutiny |
| **Review** | `#FEF3C7` (Amber 100) | `#92400E` (Amber 800) | Currently under administrative verification |
| **Selected** | `#D1FAE5` (Emerald 100)| `#065F46` (Emerald 800)| Admission granted; cleared for onboarding |
| **Rejected** | `#FEE2E2` (Red 100) | `#991B1B` (Red 800) | Application disqualified or criteria unmet |

---

## 3. Component Specs

### 🏛️ Hero Section (`landing.component.html`)
- Split 2-column layout:
  - Left column: IEM badge, large heading *"Your Future Begins Here"*, gold text highlight on "Begins Here", dual buttons: `Apply Now` (Gold `#F59E0B`) and `Explore Programs` (Dark `#18181B`).
  - Right column: IEM campus building visual.
- Highlights bar: 4 grid cards (*Easy Application, Secure & Reliable, Track in Real-time, Timely Updates*) styled with a light pastel yellow background (`#FEF3C7`), soft warm borders (`#FDE68A`), pure black logos (`#0A0A0A`), and bold black headings.
- Popular Programs & 3-Step Process: Styled with matching light yellow background (`#FEF3C7`), black logos, and black typography for optimal readability.

### 📋 Applicant Dashboard & Form
- Clean card container with step-wise visual indicators.
- File upload box with dashed border, drag-and-drop indicator, format constraints (`PDF, JPG, PNG <= 5MB`), and uploaded file pill with remove button.

### 📊 Admin Dashboard
- Top KPI stat cards: Total Applications, Under Review, Selected, Rejected.
- Filter toolbar: Department dropdown, Status dropdown, Search input.
- Data table: Applicant name, program, percentage, document link (opens `/uploads/...`), status pill, and quick transition buttons.
