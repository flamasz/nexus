export type UserRole = 'user' | 'admin';
export type DimensionUnit = 'mm' | 'cm' | 'in';
export type UploadStatus = 'uploaded' | 'approved' | 'rejected';
export type ItemStatus = 'new' | 'in_progress' | 'approved' | 'superceded';
export type ItemOrderStatus = 'new' | 'final' | 'cancel';
export type ItemPriority = '1_critical' | '2_standard' | '3_low';
export type DesignerAccessLevel = 'disabled' | 'view' | 'edit';

export interface FunctionalRoles {
  purchaser: boolean;
  vendor: boolean;
  designer: DesignerAccessLevel;
}

export interface PermissionOverrides {
  accessAdminPage?: boolean;
  manageUsers?: boolean;
  createOrder?: boolean;
  editOrderDate?: boolean;
  editOrderItems?: boolean;
  deleteOrderItems?: boolean;
  archiveOrders?: boolean;
  deleteOrders?: boolean;
  viewDesignerFields?: boolean;
  editDesignerFields?: boolean;
  openArtworkModal?: boolean;
  uploadArtwork?: boolean;
  manageUploadStatus?: boolean;
  editUploadNotes?: boolean;
  archiveUploadSessions?: boolean;
  deleteUploadSessions?: boolean;
  manageCatalog?: boolean;
  createPackagingItems?: boolean;
  editPackagingItems?: boolean;
  deletePackagingItems?: boolean;
}

export interface UserPermissions {
  functionalRoles: FunctionalRoles;
  overrides: PermissionOverrides;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  organization_id: string | null;
  permissions: UserPermissions | null;
  permissions_version: number;
  permissions_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface OrgMember {
  user_id: string;
  organization_id: string;
  role: string;
  created_at: string;
}

export interface OrgMemberWithOrg extends OrgMember {
  organization: Organization;
}

export interface Category {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  depth: number | null;
  unit: DimensionUnit;
  color: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductLine {
  id: string;
  name: string;
  organization_id: string | null;
  created_at: string;
}

export interface ItemName {
  id: string;
  name: string;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  item_name_id: string;
  category_id: string | null;
  product_line_id: string | null;
  version: string | null;
  status: ItemStatus;
  archived: boolean;
  organization_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemWithCategory extends Item {
  item_name: ItemName;
  category: Category | null;
  product_line: ProductLine | null;
}

export interface UploadSession {
  id: string;
  packaging_id: string;
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
  status: UploadStatus;
  archived: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadSessionWithDetails extends UploadSession {
  files: FileRecord[];
  uploader?: User;
}

export interface FileRecord {
  id: string;
  upload_session_id: string;
  file_name: string;
  file_size: number | null;
  file_type: string;
  storage_path: string;
  created_at: string;
}

export interface OrgOrderSettings {
  organization_id: string;
  order_prefix: string;
  order_padding: number;
  current_sequence: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  organization_id: string;
  order_number: string;
  order_sequence: number;
  order_date: string;
  created_by: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_name_id: string | null;
  category_id: string | null;
  version: string | null;
  approval_status: ItemStatus | null;
  notes: string | null;
  order_qty: number | null;
  item_order_status: ItemOrderStatus;
  priority: ItemPriority;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItemWithDetails extends OrderItem {
  item_name: ItemName | null;
  category: Category | null;
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  order_items: OrderItemWithDetails[];
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'created_at' | 'updated_at' | 'permissions_updated_at' | 'permissions_version'> & {
          created_at?: string;
          updated_at?: string;
          permissions_updated_at?: string | null;
          permissions_version?: number;
        };
        Update: Partial<Omit<User, 'id'>>;
      };
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Organization, 'id'>>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Category, 'id'>>;
      };
      product_lines: {
        Row: ProductLine;
        Insert: Omit<ProductLine, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ProductLine, 'id'>>;
      };
      item_names: {
        Row: ItemName;
        Insert: Omit<ItemName, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ItemName, 'id'>>;
      };
      items: {
        Row: Item;
        Insert: Omit<Item, 'id' | 'created_at' | 'updated_at' | 'archived' | 'product_line_id' | 'version' | 'status'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          archived?: boolean;
          product_line_id?: string | null;
          version?: string | null;
          status?: ItemStatus;
        };
        Update: Partial<Omit<Item, 'id'>>;
      };
      upload_sessions: {
        Row: UploadSession;
        Insert: Omit<UploadSession, 'id' | 'created_at' | 'updated_at' | 'uploaded_at' | 'status'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          uploaded_at?: string;
          status?: UploadStatus;
        };
        Update: Partial<Omit<UploadSession, 'id'>>;
      };
      files: {
        Row: FileRecord;
        Insert: Omit<FileRecord, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<FileRecord, 'id'>>;
      };
      purchase_orders: {
        Row: PurchaseOrder;
        Insert: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at' | 'order_number' | 'order_sequence' | 'archived'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          archived?: boolean;
        };
        Update: Partial<Omit<PurchaseOrder, 'id'>>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, 'id' | 'created_at' | 'updated_at' | 'item_order_status' | 'priority' | 'sort_order'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          item_order_status?: ItemOrderStatus;
          priority?: ItemPriority;
          sort_order?: number;
        };
        Update: Partial<Omit<OrderItem, 'id'>>;
      };
      org_order_settings: {
        Row: OrgOrderSettings;
        Insert: Omit<OrgOrderSettings, 'created_at' | 'updated_at' | 'current_sequence'> & {
          created_at?: string;
          updated_at?: string;
          current_sequence?: number;
        };
        Update: Partial<Omit<OrgOrderSettings, 'organization_id'>>;
      };
    };
  };
}
