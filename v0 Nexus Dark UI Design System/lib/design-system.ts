export type NexusRouteGroup = {
  title?: string
  items: Array<{
    label: string
    href: string
    status: 'live' | 'placeholder'
    reusablePattern: string
  }>
}

export type NexusComponentFamily = {
  name: string
  source: string
  purpose: string
  copyFiles: string[]
}

export type NexusWorkflowPattern = {
  name: string
  source: string
  reusableAs: string
  includeWhen: string
  keyBehaviors: string[]
}

export const nexusDesignSystem = {
  name: 'Nexus ERP Design System',
  packageName: 'nexus-design-system',
  sourceApp: '../nexus',
  sourceOfTruth: [
    'nexus/src/app/globals.css',
    'nexus/src/components/layout',
    'nexus/src/components/ui',
    'nexus/src/components/packaging',
    'nexus/src/components/orders',
    'nexus/src/components/uploads',
    'nexus/src/components/admin',
  ],
  principles: [
    'Dark-first slate surfaces with electric-blue emphasis.',
    'Compact enterprise controls that fit dense order and artwork workflows.',
    'Rounded geometry, subtle glass effects, and semantic badge colors.',
    'Permission-aware shell patterns that can hide or disable workflow affordances.',
    'Workflow demos separate UI anatomy from database and auth implementation details.',
  ],
} as const

export const nexusRouteGroups: NexusRouteGroup[] = [
  {
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        status: 'placeholder',
        reusablePattern: 'Centered empty-state route with large muted icon.',
      },
      {
        label: 'Analytics',
        href: '/analytics',
        status: 'placeholder',
        reusablePattern: 'Centered empty-state route ready for charts or KPIs.',
      },
    ],
  },
  {
    title: 'Purchase Orders',
    items: [
      {
        label: 'Orders',
        href: '/orders',
        status: 'live',
        reusablePattern: 'Server-prefetched data handed to a client workflow workspace.',
      },
      {
        label: 'Artwork',
        href: '/artwork',
        status: 'live',
        reusablePattern: 'Permission-aware item rail with upload review workspace.',
      },
      {
        label: 'Invoices',
        href: '/invoices',
        status: 'placeholder',
        reusablePattern: 'Centered empty-state route for future finance workflow.',
      },
      {
        label: 'Shipments',
        href: '/shipments',
        status: 'placeholder',
        reusablePattern: 'Centered empty-state route for future logistics workflow.',
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'Settings',
        href: '/settings',
        status: 'live',
        reusablePattern: 'Organization settings plus editable catalog table/cards.',
      },
      {
        label: 'Help',
        href: '/help',
        status: 'placeholder',
        reusablePattern: 'Centered empty-state route for support docs.',
      },
    ],
  },
]

export const nexusComponentFamilies: NexusComponentFamily[] = [
  {
    name: 'Foundations',
    source: 'app/globals.css',
    purpose: 'Tailwind v4 tokens, dark color system, radius scale, glass utilities, scrollbars, and number-input normalization.',
    copyFiles: ['app/globals.css'],
  },
  {
    name: 'Primitive controls',
    source: 'components/ui',
    purpose: 'Button, badge, card, input, dropdown, dialog, popover, select, tooltip, and data primitives used by the workflow surfaces.',
    copyFiles: ['components/ui', 'lib/utils.ts'],
  },
  {
    name: 'Semantic Nexus badges',
    source: 'components/ui/*-badge.tsx + lib/category-colors.ts',
    purpose: 'Reusable category, item-status, and upload-status indicators with semantic color decisions baked in.',
    copyFiles: [
      'components/ui/category-badge.tsx',
      'components/ui/item-status-badge.tsx',
      'components/ui/upload-status-badge.tsx',
      'lib/category-colors.ts',
    ],
  },
  {
    name: 'Application shell',
    source: 'components/ds/sidebar.tsx + components/ds/topbar.tsx',
    purpose: 'Portable sidebar/topbar anatomy that mirrors the current Nexus route map and organization/user controls.',
    copyFiles: ['components/ds/sidebar.tsx', 'components/ds/topbar.tsx'],
  },
  {
    name: 'Workflow previews',
    source: 'components/ds/nexus',
    purpose: 'Composable examples for artwork, purchase orders, upload review, user access, and settings/catalog flows.',
    copyFiles: ['components/ds/nexus'],
  },
]

export const nexusWorkflowPatterns: NexusWorkflowPattern[] = [
  {
    name: 'Permission-aware app shell',
    source: 'nexus/src/components/layout/AppShell.tsx, AppNav.tsx, Header.tsx',
    reusableAs: 'Default authenticated shell for B2B/internal tools.',
    includeWhen: 'A new app needs org switching, a compact left rail, and user/admin menu affordances.',
    keyBehaviors: [
      'Collapsible desktop rail and mobile overlay drawer.',
      'Route groups can filter items based on effective access.',
      'Header exposes breadcrumb, search, notifications, organization switching, settings/admin links, and sign out.',
      'Permission refresh can be layered into product apps without changing the visual API.',
    ],
  },
  {
    name: 'Artwork workspace',
    source: 'nexus/src/app/(protected)/artwork/page.tsx + components/packaging + components/uploads',
    reusableAs: 'Master-detail workspace with item catalog rail and upload/review body.',
    includeWhen: 'A new app manages documents, assets, SKUs, or reviewed deliverables.',
    keyBehaviors: [
      'Searchable item rail with archived-item toggle.',
      'Combobox metadata editing for item name, product line, category, and version.',
      'Category editor supports dimensions and remembered custom colors.',
      'Upload sessions carry status, files, notes, archive/delete actions, and email hooks in the source app.',
    ],
  },
  {
    name: 'Purchase-order editor',
    source: 'nexus/src/components/orders',
    reusableAs: 'Dense line-item table with inline editing and artwork handoff.',
    includeWhen: 'A workflow has sortable rows, compact statuses, quantities, versioned assets, or debounced notes.',
    keyBehaviors: [
      'Server route prefetch seeds the client workspace to avoid first-render races.',
      'Sortable order rows preserve compact column widths.',
      'Quantity formatting keeps cursor position while adding thousands separators.',
      'Version dropdown fetches from a scoped API when item + category change.',
      'Notes autosave on debounce and destructive row actions are permission-gated.',
    ],
  },
  {
    name: 'Admin access editor',
    source: 'nexus/src/app/(protected)/admin/page.tsx + components/admin/UserList.tsx',
    reusableAs: 'Organization-scoped user/role management surface.',
    includeWhen: 'A new app needs a compact user list plus role/permission toggles.',
    keyBehaviors: [
      'Route access redirects when the current user cannot manage users.',
      'Rows summarize effective roles and functional labels.',
      'Editor groups granular permissions into reviewable toggle cards.',
      'Password changes stay separate from role assignment.',
    ],
  },
  {
    name: 'Settings catalog',
    source: 'nexus/src/app/(protected)/settings/page.tsx + components/packaging/CategoryForm.tsx',
    reusableAs: 'Organization settings and editable design-token-aligned catalog management.',
    includeWhen: 'A new app has org-level prefixes, naming rules, dimensions, colors, or controlled vocabularies.',
    keyBehaviors: [
      'Settings use card surfaces and inline save feedback.',
      'Category rows reuse the same semantic color classes as workflow badges.',
      'Dimensions render with a shared formatter.',
      'Create/edit flows can be reused as modal or page-level forms.',
    ],
  },
]

export const nexusAdoptionSteps = [
  {
    title: 'Copy foundations first',
    detail: 'Move app/globals.css, lib/utils.ts, and the ui primitives into the new Next/Tailwind v4 app before copying workflow examples.',
  },
  {
    title: 'Install peer primitives',
    detail: 'Keep Radix, class-variance-authority, tailwind-merge, lucide-react, tw-animate-css, and next/font aligned with this package or the current Nexus app.',
  },
  {
    title: 'Compose the shell',
    detail: 'Start new apps from the sidebar/topbar route-group model, then replace mock org/user data with the target app auth provider.',
  },
  {
    title: 'Promote workflow examples gradually',
    detail: 'Use the ds/nexus previews as component anatomy references; wire product data and server actions only in the destination app.',
  },
  {
    title: 'Keep semantic badges stable',
    detail: 'Use CategoryBadge, ItemStatusBadge, and UploadStatusBadge instead of ad-hoc color classes so new apps retain Nexus status language.',
  },
]
