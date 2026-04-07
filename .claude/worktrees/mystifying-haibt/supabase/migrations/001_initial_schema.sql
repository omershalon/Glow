-- ==============================================
-- Glow Skincare App - Initial Database Schema
-- ==============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- ENUM TYPES
-- ==============================================

CREATE TYPE skin_type_enum AS ENUM ('oily', 'dry', 'combination', 'sensitive', 'normal');
CREATE TYPE acne_type_enum AS ENUM ('hormonal', 'cystic', 'comedonal', 'fungal', 'inflammatory');
CREATE TYPE severity_enum AS ENUM ('mild', 'moderate', 'severe');
CREATE TYPE subscription_tier_enum AS ENUM ('free', 'premium');
CREATE TYPE verdict_enum AS ENUM ('suitable', 'unsuitable', 'caution');

-- ==============================================
-- TABLES
-- ==============================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    age INTEGER CHECK (age > 0 AND age < 150),
    subscription_tier subscription_tier_enum NOT NULL DEFAULT 'free',
    product_scans_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Skin Profiles (AI analysis results)
CREATE TABLE IF NOT EXISTS public.skin_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    skin_type skin_type_enum NOT NULL,
    acne_type acne_type_enum NOT NULL,
    severity severity_enum NOT NULL,
    analysis_notes TEXT NOT NULL DEFAULT '',
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Personalized Plans (4-pillar plan)
CREATE TABLE IF NOT EXISTS public.personalized_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    skin_profile_id UUID REFERENCES public.skin_profiles(id) ON DELETE CASCADE NOT NULL,
    products_pillar JSONB NOT NULL DEFAULT '{}',
    diet_pillar JSONB NOT NULL DEFAULT '{}',
    herbal_pillar JSONB NOT NULL DEFAULT '{}',
    lifestyle_pillar JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Progress Photos
CREATE TABLE IF NOT EXISTS public.progress_photos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    photo_url TEXT NOT NULL,
    week_number INTEGER NOT NULL DEFAULT 1,
    severity_score DECIMAL(4,2) NOT NULL CHECK (severity_score >= 0 AND severity_score <= 10),
    improvement_percentage DECIMAL(6,2),
    analysis_notes TEXT NOT NULL DEFAULT '',
    annotations JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Product Scans
CREATE TABLE IF NOT EXISTS public.product_scans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    barcode TEXT NOT NULL,
    product_name TEXT NOT NULL,
    verdict verdict_enum NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    ingredients TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Onboarding Data
CREATE TABLE IF NOT EXISTS public.onboarding_data (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    age_range TEXT NOT NULL DEFAULT '',
    acne_duration TEXT NOT NULL DEFAULT '',
    tried_products TEXT[] NOT NULL DEFAULT '{}',
    known_allergies TEXT[] NOT NULL DEFAULT '{}',
    skin_concerns TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ==============================================
-- INDEXES
-- ==============================================

CREATE INDEX idx_skin_profiles_user_id ON public.skin_profiles(user_id);
CREATE INDEX idx_skin_profiles_created_at ON public.skin_profiles(created_at DESC);

CREATE INDEX idx_personalized_plans_user_id ON public.personalized_plans(user_id);
CREATE INDEX idx_personalized_plans_is_active ON public.personalized_plans(is_active);
CREATE INDEX idx_personalized_plans_skin_profile_id ON public.personalized_plans(skin_profile_id);

CREATE INDEX idx_progress_photos_user_id ON public.progress_photos(user_id);
CREATE INDEX idx_progress_photos_created_at ON public.progress_photos(created_at DESC);
CREATE INDEX idx_progress_photos_week_number ON public.progress_photos(week_number);

CREATE INDEX idx_product_scans_user_id ON public.product_scans(user_id);
CREATE INDEX idx_product_scans_barcode ON public.product_scans(barcode);
CREATE INDEX idx_product_scans_created_at ON public.product_scans(created_at DESC);

CREATE INDEX idx_onboarding_data_user_id ON public.onboarding_data(user_id);

-- ==============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER skin_profiles_updated_at
    BEFORE UPDATE ON public.skin_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER personalized_plans_updated_at
    BEFORE UPDATE ON public.personalized_plans
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER progress_photos_updated_at
    BEFORE UPDATE ON public.progress_photos
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER onboarding_data_updated_at
    BEFORE UPDATE ON public.onboarding_data
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================
-- AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- ==============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personalized_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_data ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- SKIN_PROFILES policies
CREATE POLICY "Users can view own skin profiles"
    ON public.skin_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own skin profiles"
    ON public.skin_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own skin profiles"
    ON public.skin_profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own skin profiles"
    ON public.skin_profiles FOR DELETE
    USING (auth.uid() = user_id);

-- PERSONALIZED_PLANS policies
CREATE POLICY "Users can view own plans"
    ON public.personalized_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plans"
    ON public.personalized_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
    ON public.personalized_plans FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all plans"
    ON public.personalized_plans FOR ALL
    USING (auth.role() = 'service_role');

-- PROGRESS_PHOTOS policies
CREATE POLICY "Users can view own progress photos"
    ON public.progress_photos FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress photos"
    ON public.progress_photos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress photos"
    ON public.progress_photos FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress photos"
    ON public.progress_photos FOR DELETE
    USING (auth.uid() = user_id);

-- PRODUCT_SCANS policies
CREATE POLICY "Users can view own product scans"
    ON public.product_scans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own product scans"
    ON public.product_scans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ONBOARDING_DATA policies
CREATE POLICY "Users can view own onboarding data"
    ON public.onboarding_data FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding data"
    ON public.onboarding_data FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding data"
    ON public.onboarding_data FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role can access everything (for edge functions)
CREATE POLICY "Service role can access all skin_profiles"
    ON public.skin_profiles FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all progress_photos"
    ON public.progress_photos FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all product_scans"
    ON public.product_scans FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all onboarding_data"
    ON public.onboarding_data FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all profiles"
    ON public.profiles FOR ALL
    USING (auth.role() = 'service_role');

-- ==============================================
-- STORAGE BUCKETS
-- ==============================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('skin-photos', 'skin-photos', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('progress-photos', 'progress-photos', false) ON CONFLICT DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Users can upload own skin photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'skin-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own skin photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'skin-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own skin photos"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'skin-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own progress photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own progress photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Service role can access all storage"
    ON storage.objects FOR ALL
    USING (auth.role() = 'service_role');
