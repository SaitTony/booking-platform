# Workflows — UI Component Catalog

> **Canonical UI standard for Workflows.** This catalog is the single approved source for choosing, designing, and implementing interface components across the product. Use only the components, variants, patterns, and iconography documented here. Do not introduce a competing design system, ad-hoc controls, or icons from another library.

## 1. Design reference and authority

The visual and interaction reference is **GitHub Primer**, especially its product UI patterns and **Octicons** icon set:

- [Primer Product Components](https://primer.style/product/components/)
- [Primer Octicons](https://primer.style/octicons/)
- [Primer CSS](https://github.com/primer/css)

The Workflows interface should follow GitHub's restrained, compact, functional visual language: clear hierarchy, neutral surfaces, precise borders, consistent spacing, compact controls, and recognizable states.

This document governs Workflows UI decisions. When a component or variant is not listed here, do not invent one in product code. First update this catalog and agree on the addition.

## 2. Approved component inventory

### 2.1 Buttons

Use only these button variants:

| Variant | Purpose | Usage |
|---|---|---|
| Primary | Main action on a page or in a dialog | One dominant action in a context, e.g. Create account |
| Default | Ordinary secondary actions | Edit, Refresh, Cancel |
| Danger | Destructive actions | Delete, Disable where destructive confirmation is required |

Approved button patterns:
- Text-only button.
- Button with a leading Octicon.
- Icon-only button, only when the icon is unambiguous; provide an accessible name/tooltip.
- Compact button for dense table and toolbar contexts.

Rules:
- Keep button height, radius, border, typography, and horizontal padding consistent by variant and size.
- Do not turn buttons into pills or circles unless a documented Primer pattern requires it.
- Do not change the shape or styling of an existing control just to reposition it.
- Do not use multiple competing Primary buttons in the same action group.

### 2.2 Form controls

Approved controls:
- Search input with leading search icon.
- Standard text input.
- Email and phone inputs.
- Select / dropdown.
- Checkbox.
- Toggle / switch.
- Tokenized filter input only where multi-value filtering is needed.

Rules:
- Labels remain visible and descriptive; placeholders are examples or hints, not substitutes for labels.
- Search and filter controls use the same height and typography when placed in one toolbar.
- Checkbox and toggle are distinct controls; never replace one with the other.
- Preserve the established appearance and behavior when moving an existing control.
- Disabled, read-only, invalid, focused, and selected states must be visually distinguishable.

### 2.3 Labels and status badges

Approved semantic labels:
- Roles: Owner, Admin, Master_pro, Master.
- Statuses: Active, Disabled / Inactive, Pending (only where the underlying state exists).
- Neutral metadata labels where needed.

Rules:
- Use compact, low-emphasis badges with consistent padding and border radius.
- Color communicates meaning, not decoration.
- Do not use badges for headings, ordinary metadata, or repeated decorative emphasis.
- Do not invent statuses that are not represented in application data.

### 2.4 Data tables and lists

Approved table pattern:
- Clear column headers.
- Compact rows with consistent vertical alignment.
- Readable primary text and muted secondary text.
- Optional leading avatar or entity icon.
- Separate columns for distinct data concepts (for example, Company and Page).
- Row-level actions in a trailing actions area.

Rules:
- Keep row height, cell padding, header typography, and separators consistent.
- Use stable column alignment and avoid truncating important identifiers without an accessible way to inspect them.
- Do not place unrelated controls inside a row.
- Use pagination or a documented loading/empty state when appropriate.
- Keep read-only list data read-only; editing belongs in the documented edit surface.

### 2.5 Avatars and entity indicators

Approved patterns:
- User avatar (photo or initials fallback).
- Company / page icon.
- Generic entity icon where no image exists.

Rules:
- Use consistent sizes within the same list or table.
- Initials fallback must remain legible and visually neutral.
- Do not use emoji as a substitute for product icons.

### 2.6 Navigation

Approved patterns:
- Horizontal primary navigation with icon and text.
- Tabs for switching between closely related views within a section.
- Breadcrumbs for hierarchical navigation where needed.
- Sidebar navigation only where the page architecture explicitly calls for it.

Rules:
- Navigation items use Octicons and consistent icon sizing.
- Active state must be clear without relying on color alone.
- Align navigation items consistently within their containing bar and separators.
- Do not add duplicate product/section branding to navigation when it is not part of the approved page design.

### 2.7 Segmented controls and filters

Approved patterns:
- Segmented control for a small set of mutually exclusive view modes.
- Filter dropdowns for role, status, company, and other supported data dimensions.
- Search combined with filters in a single toolbar.

Rules:
- Use segmented controls only for mutually exclusive choices, not as a replacement for navigation.
- Filter labels and search text use consistent typography and control height.
- Selected filters must be visible and removable where applicable.
- Filter options must reflect real application data and permissions.

### 2.8 Menus and dialogs

Approved patterns:
- Compact contextual menu opened by an ellipsis action.
- Settings/edit dialog or panel for secondary account configuration.
- Confirmation dialog for destructive or irreversible actions.

Rules:
- Menus contain concise action labels and Octicons where useful.
- Destructive actions are visually separated and use the Danger treatment.
- Dialogs have a clear title, content area, and explicit action footer.
- Do not place persistent helper text in a menu when it adds no actionable information.
- Dialogs must not silently change unrelated fields or page state.

## 3. Approved iconography — Octicons only

**Octicons is the only approved icon family.** Do not use Lucide, Font Awesome, Material Icons, emoji, hand-drawn SVG symbols, or mixed icon sets in the product UI.

Use the closest official Octicon for each semantic purpose. The following groups define the approved icon roles; use the official Octicon names and artwork from the [Octicons catalog](https://primer.style/octicons/).

| Area | Semantic use |
|---|---|
| Navigation | Overview / dashboard, accounts / people, companies / organization, settings / gear |
| Actions | Create / plus, edit / pencil, save / check, delete / trash, more actions / three dots, refresh |
| Status | Success / check, warning / alert, error / x or stop, pending / clock |
| Search and filters | Search / magnifying glass, filter / funnel, clear / x |
| Users and access | Person, people, shield / permissions, key / password, mail |
| Companies and pages | Organization / building, project or page / browser, link / link |

Icon rules:
- Use official Octicons with consistent optical size and stroke/fill treatment.
- Prefer the same icon for the same action throughout Workflows.
- Pair ambiguous icons with text; icon-only actions require accessible labels.
- Do not substitute a visually similar icon from another library.
- Before using an icon, verify its exact name in the official Octicons catalog.

## 4. Shared visual and interaction rules

- **Consistency:** the same component must look and behave the same wherever it appears.
- **Hierarchy:** Primary is reserved for the main action; Default for secondary actions; Danger for destructive actions.
- **Density:** prefer GitHub-like compact layouts without sacrificing readability.
- **Typography:** related controls in one toolbar share font size, weight, and line-height.
- **Spacing:** use a consistent spacing scale; do not add arbitrary one-off margins to compensate for misalignment.
- **Borders and surfaces:** prefer restrained neutral borders and surfaces over decorative shadows, gradients, or saturated fills.
- **States:** every interactive component must define default, hover, focus, active/selected, disabled, and (where relevant) loading or invalid states.
- **Accessibility:** keyboard operation, visible focus, semantic labels, and sufficient contrast are required.
- **Responsive behavior:** controls may wrap or stack at narrow widths, but their order and meaning must remain clear.

## 5. Prohibited deviations

Unless this catalog is explicitly amended, do not:
- Introduce controls or patterns from another UI kit.
- Mix Octicons with Lucide or another icon family.
- Create one-off button shapes, switches, badges, or dropdowns.
- Change an existing control's appearance when the request is only to move or align it.
- Add decorative elements that are not part of a documented component.
- Create new component variants because they are convenient for one screen.

## 6. How to add or change a component

1. Identify the product need that cannot be met by an approved component.
2. Compare the proposed pattern with GitHub Primer and Octicons.
3. Update this catalog first with the component, variants, states, and usage rules.
4. Review and approve the catalog change before implementing it in product UI.
5. Implement the approved pattern consistently; do not alter unrelated screens or components.

## 7. Scope and rollout

This catalog is the canonical standard for all future Workflows UI decisions. For the current development stream, implementation work remains limited to the **new Accounts prototype** unless the user explicitly authorizes changes elsewhere. The existing/main admin interface must not be modified as part of prototype work.

---

*Last updated: 2026-11-09*
