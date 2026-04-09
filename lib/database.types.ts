export type SkinType = 'oily' | 'dry' | 'combination' | 'sensitive' | 'normal';
export type AcneType = 'hormonal' | 'cystic' | 'comedonal' | 'fungal' | 'inflammatory';
export type Severity = 'mild' | 'moderate' | 'severe';
export type SubscriptionTier = 'free' | 'premium';
export type Verdict = 'suitable' | 'unsuitable' | 'caution';

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          age: number | null;
          subscription_tier: SubscriptionTier;
          product_scans_used: number;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          age?: number | null;
          subscription_tier?: SubscriptionTier;
          product_scans_used?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          age?: number | null;
          subscription_tier?: SubscriptionTier;
          product_scans_used?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      skin_profiles: {
        Row: {
          id: string;
          user_id: string;
          skin_type: SkinType;
          acne_type: AcneType;
          severity: Severity;
          analysis_notes: string;
          photo_url: string | null;
          zones: Record<string, { severity: string; note: string }>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          skin_type: SkinType;
          acne_type: AcneType;
          severity: Severity;
          analysis_notes: string;
          photo_url?: string | null;
          zones?: Record<string, { severity: string; note: string }>;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          skin_type?: SkinType;
          acne_type?: AcneType;
          severity?: Severity;
          analysis_notes?: string;
          photo_url?: string | null;
          zones?: Record<string, { severity: string; note: string }>;
          created_at?: string;
        };
        Relationships: [];
      };
      personalized_plans: {
        Row: {
          id: string;
          user_id: string;
          skin_profile_id: string;
          products_pillar: ProductsPillar;
          diet_pillar: DietPillar;
          herbal_pillar: HerbalPillar;
          lifestyle_pillar: LifestylePillar;
          ranked_items: RankedItem[];
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          skin_profile_id: string;
          products_pillar: ProductsPillar;
          diet_pillar: DietPillar;
          herbal_pillar: HerbalPillar;
          lifestyle_pillar: LifestylePillar;
          ranked_items?: RankedItem[];
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          skin_profile_id?: string;
          products_pillar?: ProductsPillar;
          diet_pillar?: DietPillar;
          herbal_pillar?: HerbalPillar;
          lifestyle_pillar?: LifestylePillar;
          ranked_items?: RankedItem[];
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      routine_items: {
        Row: RoutineItem;
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          pillar: string;
          title: string;
          rationale: string;
          impact_rank: number;
          is_active?: boolean;
          added_at?: string;
        };
        Update: {
          is_active?: boolean;
        };
        Relationships: [];
      };
      progress_photos: {
        Row: {
          id: string;
          user_id: string;
          photo_url: string;
          week_number: number;
          severity_score: number;
          improvement_percentage: number | null;
          analysis_notes: string;
          notes: string;
          annotations: ZoneAnnotations;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          photo_url: string;
          week_number: number;
          severity_score: number;
          improvement_percentage?: number | null;
          analysis_notes: string;
          notes?: string;
          annotations: ZoneAnnotations;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          photo_url?: string;
          week_number?: number;
          severity_score?: number;
          improvement_percentage?: number | null;
          analysis_notes?: string;
          notes?: string;
          annotations?: ZoneAnnotations;
          created_at?: string;
        };
        Relationships: [];
      };
      product_scans: {
        Row: {
          id: string;
          user_id: string;
          barcode: string;
          product_name: string;
          verdict: Verdict;
          reason: string;
          ingredients: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          barcode: string;
          product_name: string;
          verdict: Verdict;
          reason: string;
          ingredients: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          barcode?: string;
          product_name?: string;
          verdict?: Verdict;
          reason?: string;
          ingredients?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      onboarding_data: {
        Row: {
          id: string;
          user_id: string;
          age_range: string;
          acne_duration: string;
          tried_products: string[];
          known_allergies: string[];
          skin_concerns: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          age_range: string;
          acne_duration: string;
          tried_products?: string[];
          known_allergies?: string[];
          skin_concerns?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          age_range?: string;
          acne_duration?: string;
          tried_products?: string[];
          known_allergies?: string[];
          skin_concerns?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      scan_sessions: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          front_image_url: string;
          left_image_url: string;
          right_image_url: string;
          model_detections: Record<string, any>;
          reviewed_detections: Record<string, any> | null;
          severity: 'mild' | 'moderate' | 'severe' | null;
          severity_score: number | null;
          total_spots: number | null;
          confirmed_spots: number | null;
          ai_added_spots: number | null;
          primary_acne_type: string | null;
          description: string | null;
          zone_breakdown: any[] | null;
          skin_insights: Record<string, any> | null;
          recommendations: any[] | null;
          skin_plan: Record<string, any> | null;
          matched_products: any[] | null;
          status: 'processing' | 'completed' | 'failed';
        };
        Insert: {
          id?: string;
          user_id: string;
          front_image_url: string;
          left_image_url: string;
          right_image_url: string;
          model_detections: Record<string, any>;
          status?: 'processing' | 'completed' | 'failed';
        };
        Update: {
          reviewed_detections?: Record<string, any>;
          severity?: string;
          severity_score?: number;
          total_spots?: number;
          confirmed_spots?: number;
          ai_added_spots?: number;
          primary_acne_type?: string;
          description?: string;
          zone_breakdown?: any[];
          skin_insights?: Record<string, any>;
          recommendations?: any[];
          skin_plan?: Record<string, any>;
          matched_products?: any[];
          status?: 'processing' | 'completed' | 'failed';
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

// Pillar types
export interface RoutineStep {
  step: number;
  name: string;
  product_type: string;
  key_ingredients: string[];
  instructions: string;
}

export interface ProductsPillar {
  morning_routine: RoutineStep[];
  evening_routine: RoutineStep[];
  ingredients_to_use: string[];
  ingredients_to_avoid: string[];
  top_product_recommendations: string[];
}

export interface FoodItem {
  food: string;
  reason: string;
  frequency: string;
}

export interface DietPillar {
  foods_to_eat: FoodItem[];
  foods_to_reduce: FoodItem[];
  meal_swaps: Array<{ instead_of: string; try: string; why: string }>;
  supplements: Array<{ name: string; dose: string; benefit: string }>;
  hydration_tips: string[];
}

export interface HerbalRemedy {
  name: string;
  form: string;
  dosage: string;
  application: string;
  evidence: string;
  caution: string | null;
}

export interface HerbalPillar {
  remedies: HerbalRemedy[];
  diy_masks: Array<{ name: string; ingredients: string[]; instructions: string; frequency: string }>;
  teas: Array<{ name: string; benefit: string; preparation: string }>;
}

export interface LifestyleHabit {
  habit: string;
  frequency: string;
  why: string;
  how_to_start: string;
}

export interface LifestylePillar {
  daily_habits: LifestyleHabit[];
  sleep_tips: string[];
  stress_management: string[];
  exercise_guidance: string;
  things_to_avoid: string[];
}

export interface RankedItem {
  pillar: 'herbal' | 'diet' | 'product' | 'lifestyle';
  title: string;
  rationale: string;
  impact_rank: number;
}

export interface RoutineItem {
  id: string;
  user_id: string;
  plan_id: string;
  pillar: string;
  title: string;
  rationale: string;
  impact_rank: number;
  is_active: boolean;
  added_at: string;
}

export interface ZoneAnnotations {
  forehead: string;
  nose: string;
  left_cheek: string;
  right_cheek: string;
  chin: string;
  overall: string;
}
