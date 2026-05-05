export interface Couple {
  id: string
  created_at: string
  couple_name: string
  partner1_name: string
  partner2_name: string
  partner1_age?: number
  partner2_age?: number
  partner1_id?: string
  partner2_id?: string
  address?: string
  how_met?: string
  phone?: string
  event_date: string
  guest_count: number
  estimated_guests?: number
  wedding_style: string
  budget: number
  notes?: string
  status?: string
  has_venue?: boolean
  venue_name?: string
  venue_cost?: number
  wedding_vision?: string
  important_vendors?: string
  couple_link_token?: string
  producer_role_vision?: string
}

export interface Vendor {
  id: string
  wedding_id: string
  vendor_name: string
  vendor_type: string
  category?: string
  pricing_type: string
  price_per_head?: number
  contract_amount: number
  amount_paid: number
  is_confirmed?: boolean
  contract_file_url?: string
  notes?: string
  vendor_phone?: string
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  wedding_id: string
  vendor_id?: string
  file_name: string
  file_url: string
  uploaded_by: string
  created_at: string
}
