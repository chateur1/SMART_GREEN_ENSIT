-- ============================================================
-- SMART GREEN ENSIT — PostgreSQL Database Schema
-- Carbon Footprint Management Platform
-- ============================================================

-- ============================================================
-- SECTION 0: EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SECTION 1: USERS & ACCESS CONTROL
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'viewer');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    hashed_password TEXT NOT NULL,
    role            user_role NOT NULL DEFAULT 'viewer',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'Platform users with role-based access control';

-- ============================================================
-- SECTION 2: CAMPUS ORGANIZATIONAL STRUCTURE
-- ============================================================

CREATE TYPE building_type AS ENUM (
    'pedagogical',   -- salles de cours, amphis
    'laboratory',    -- labos d enseignement et recherche
    'administrative',
    'technical'
);

CREATE TABLE buildings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(50) UNIQUE NOT NULL,       -- e.g. "LAB-A", "ADMIN-1"
    building_type   building_type NOT NULL,
    surface_m2      NUMERIC(10,2),                     -- for tCO2e/m² KPI
    floor_count     SMALLINT,
    year_built      SMALLINT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE buildings IS 'Campus buildings and facilities within organizational perimeter';

CREATE TABLE entities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,             -- e.g. "Labo Génie Civil", "Dept. Info"
    code            VARCHAR(50) UNIQUE NOT NULL,
    building_id     UUID REFERENCES buildings(id),
    head_count      INTEGER,                           -- for tCO2e/person KPI
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE entities IS 'Laboratories, departments, and administrative units';

-- ============================================================
-- SECTION 3: EMISSION FACTORS REFERENCE TABLE
-- (Source: ADEME Base Carbone / GHG Protocol)
-- ============================================================

CREATE TYPE emission_scope AS ENUM ('scope1', 'scope2', 'scope3');

CREATE TYPE emission_category AS ENUM (
    -- Scope 1
    'fuel_combustion',
    'company_vehicles',
    'refrigerant_leaks',
    -- Scope 2
    'electricity',
    -- Scope 3
    'commuting_car',
    'commuting_bus',
    'commuting_train',
    'commuting_motorcycle',
    'commuting_bicycle',
    'commuting_walking'
);

CREATE TABLE emission_factors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category        emission_category NOT NULL,
    scope           emission_scope NOT NULL,
    label           VARCHAR(255) NOT NULL,             -- human-readable name
    factor_value    NUMERIC(12,6) NOT NULL,            -- kgCO2e per unit
    unit            VARCHAR(50) NOT NULL,              -- e.g. 'kWh', 'liter', 'km', 'kg'
    source          VARCHAR(255) NOT NULL DEFAULT 'ADEME Base Carbone',
    valid_from      DATE NOT NULL DEFAULT '2024-01-01',
    valid_until     DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE emission_factors IS 'Reference emission factors from ADEME Base Carbone and GHG Protocol';

-- ============================================================
-- SECTION 4: REPORTING PERIODS
-- ============================================================

CREATE TABLE reporting_periods (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label           VARCHAR(100) NOT NULL,             -- e.g. "Année 2024", "S1 2025"
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    is_closed       BOOLEAN NOT NULL DEFAULT FALSE,    -- locked once validated
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_period CHECK (end_date > start_date)
);

COMMENT ON TABLE reporting_periods IS 'Annual or sub-annual reporting periods for carbon accounting';

-- ============================================================
-- SECTION 5: SCOPE 1 — DIRECT EMISSIONS
-- ============================================================

-- 5a. Fuel Combustion (heating, generators, etc.)
CREATE TABLE scope1_fuel_consumption (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id           UUID NOT NULL REFERENCES reporting_periods(id),
    building_id         UUID REFERENCES buildings(id),
    fuel_type           VARCHAR(100) NOT NULL,          -- 'natural_gas', 'diesel', 'fuel_oil'
    quantity            NUMERIC(12,3) NOT NULL,         -- in liters or m³
    unit                VARCHAR(20) NOT NULL,           -- 'liter' or 'm3'
    emission_factor_id  UUID NOT NULL REFERENCES emission_factors(id),
    co2e_kg             NUMERIC(12,3),                  -- calculated: quantity × factor
    invoice_ref         VARCHAR(255),                   -- bill reference number
    invoice_date        DATE,
    data_source         VARCHAR(100) DEFAULT 'invoice', -- 'invoice', 'estimate', 'meter'
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5b. Company Vehicle Fuel
CREATE TABLE scope1_vehicle_fuel (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id           UUID NOT NULL REFERENCES reporting_periods(id),
    vehicle_description VARCHAR(255),
    fuel_type           VARCHAR(50) NOT NULL,           -- 'essence', 'diesel', 'electric'
    quantity_liters     NUMERIC(10,3) NOT NULL,
    emission_factor_id  UUID NOT NULL REFERENCES emission_factors(id),
    co2e_kg             NUMERIC(12,3),
    trip_purpose        VARCHAR(255),
    data_source         VARCHAR(100) DEFAULT 'invoice',
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5c. Refrigerant Leaks (fugitive emissions)
CREATE TABLE scope1_refrigerant_leaks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id           UUID NOT NULL REFERENCES reporting_periods(id),
    building_id         UUID REFERENCES buildings(id),
    refrigerant_type    VARCHAR(100) NOT NULL,          -- 'R-410A', 'R-32', 'R-22', etc.
    quantity_kg         NUMERIC(10,3) NOT NULL,         -- kg of refrigerant leaked/recharged
    gwp                 NUMERIC(10,2) NOT NULL,         -- Global Warming Potential
    co2e_kg             NUMERIC(12,3),                  -- quantity × GWP
    maintenance_date    DATE,
    technician_ref      VARCHAR(255),
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE scope1_refrigerant_leaks IS 'Fugitive refrigerant emissions from HVAC systems — high GWP impact';

-- ============================================================
-- SECTION 6: SCOPE 2 — INDIRECT ENERGY EMISSIONS
-- ============================================================

CREATE TABLE scope2_electricity (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id           UUID NOT NULL REFERENCES reporting_periods(id),
    building_id         UUID REFERENCES buildings(id),
    kwh_consumed        NUMERIC(12,3) NOT NULL,
    emission_factor_id  UUID NOT NULL REFERENCES emission_factors(id),
    co2e_kg             NUMERIC(12,3),                  -- kWh × factor
    invoice_ref         VARCHAR(255),
    invoice_date        DATE,
    data_source         VARCHAR(100) DEFAULT 'invoice',
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE scope2_electricity IS 'Electricity consumption — primary source of indirect emissions';

-- ============================================================
-- SECTION 7: SCOPE 3 — COMMUTING (restricted perimeter)
-- ============================================================

CREATE TYPE user_category AS ENUM ('student', 'faculty', 'administrative');
CREATE TYPE transport_mode AS ENUM (
    'car_solo', 'car_shared', 'bus', 'train', 'metro',
    'motorcycle', 'bicycle', 'walking', 'other'
);

-- Survey responses (one row per respondent)
CREATE TABLE scope3_commuting_surveys (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id               UUID NOT NULL REFERENCES reporting_periods(id),
    respondent_category     user_category NOT NULL,
    transport_mode          transport_mode NOT NULL,
    distance_km_one_way     NUMERIC(8,2) NOT NULL,      -- one-way distance in km
    days_per_week           NUMERIC(3,1) NOT NULL,      -- average working days commuting
    weeks_per_year          SMALLINT NOT NULL DEFAULT 36,
    emission_factor_id      UUID NOT NULL REFERENCES emission_factors(id),
    co2e_kg                 NUMERIC(12,3),              -- calculated total for this respondent
    is_anonymous            BOOLEAN DEFAULT TRUE,
    submitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE scope3_commuting_surveys IS 'Mobility survey responses for home-campus commuting (Scope 3)';

-- Aggregated summary per period (for reporting)
CREATE TABLE scope3_commuting_summary (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id               UUID NOT NULL REFERENCES reporting_periods(id) UNIQUE,
    total_respondents       INTEGER NOT NULL DEFAULT 0,
    student_count           INTEGER DEFAULT 0,
    faculty_count           INTEGER DEFAULT 0,
    admin_count             INTEGER DEFAULT 0,
    total_co2e_kg           NUMERIC(14,3) DEFAULT 0,
    extrapolation_factor    NUMERIC(6,3) DEFAULT 1.0,   -- if survey is a sample
    extrapolated_co2e_kg    NUMERIC(14,3) DEFAULT 0,
    methodology_notes       TEXT,
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 8: CONSOLIDATED EMISSIONS — BILAN CARBONE
-- ============================================================

CREATE TABLE carbon_balance (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id           UUID NOT NULL REFERENCES reporting_periods(id) UNIQUE,

    -- Scope 1 (tCO2e)
    s1_fuel_tco2e       NUMERIC(12,3) DEFAULT 0,
    s1_vehicles_tco2e   NUMERIC(12,3) DEFAULT 0,
    s1_refrigerants_tco2e NUMERIC(12,3) DEFAULT 0,
    scope1_total_tco2e  NUMERIC(12,3) DEFAULT 0,

    -- Scope 2 (tCO2e)
    scope2_total_tco2e  NUMERIC(12,3) DEFAULT 0,

    -- Scope 3 (tCO2e)
    scope3_total_tco2e  NUMERIC(12,3) DEFAULT 0,

    -- Grand total
    grand_total_tco2e   NUMERIC(12,3) DEFAULT 0,

    -- Normalized KPIs (mandatory per cahier des charges)
    total_students          INTEGER,
    total_surface_m2        NUMERIC(12,2),
    total_entities          INTEGER,
    kpi_tco2e_per_student   NUMERIC(10,4),
    kpi_tco2e_per_m2        NUMERIC(10,4),
    kpi_tco2e_per_entity    NUMERIC(10,4),

    -- Metadata
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    computed_by         UUID REFERENCES users(id),
    is_validated        BOOLEAN DEFAULT FALSE,
    validation_notes    TEXT
);

COMMENT ON TABLE carbon_balance IS 'Final consolidated carbon balance per period with mandatory KPIs';

-- ============================================================
-- SECTION 9: AI / ML PREDICTIONS & SCENARIOS
-- ============================================================

CREATE TABLE emission_forecasts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_period_id  UUID NOT NULL REFERENCES reporting_periods(id),
    forecast_year   SMALLINT NOT NULL,
    scope           emission_scope,                    -- NULL = all scopes
    model_name      VARCHAR(100) NOT NULL,             -- e.g. 'linear_regression', 'prophet'
    predicted_tco2e NUMERIC(12,3) NOT NULL,
    confidence_low  NUMERIC(12,3),
    confidence_high NUMERIC(12,3),
    model_params    JSONB,                             -- model hyperparameters
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE scenarios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    base_period_id  UUID NOT NULL REFERENCES reporting_periods(id),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE scenario_results (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id             UUID NOT NULL REFERENCES scenarios(id),
    scope                   emission_scope NOT NULL,
    category                emission_category,
    baseline_tco2e          NUMERIC(12,3) NOT NULL,
    simulated_tco2e         NUMERIC(12,3) NOT NULL,
    reduction_tco2e         NUMERIC(12,3),             -- baseline - simulated
    reduction_percent       NUMERIC(6,2),
    assumptions             JSONB,                     -- e.g. {"modal_shift_percent": 30}
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE scenarios IS 'What-if scenario simulations for ecological transition planning';

-- ============================================================
-- SECTION 10: AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,                 -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
    table_name  VARCHAR(100),
    record_id   UUID,
    old_values  JSONB,
    new_values  JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_log IS 'Full audit trail for all data modifications';

-- ============================================================
-- SECTION 11: INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX idx_scope1_fuel_period    ON scope1_fuel_consumption(period_id);
CREATE INDEX idx_scope1_fuel_building  ON scope1_fuel_consumption(building_id);
CREATE INDEX idx_scope2_elec_period    ON scope2_electricity(period_id);
CREATE INDEX idx_scope2_elec_building  ON scope2_electricity(building_id);
CREATE INDEX idx_scope3_survey_period  ON scope3_commuting_surveys(period_id);
CREATE INDEX idx_scope3_survey_mode    ON scope3_commuting_surveys(transport_mode);
CREATE INDEX idx_carbon_balance_period ON carbon_balance(period_id);
CREATE INDEX idx_forecasts_base_period ON emission_forecasts(base_period_id);
CREATE INDEX idx_scenarios_period      ON scenarios(base_period_id);
CREATE INDEX idx_audit_user            ON audit_log(user_id);
CREATE INDEX idx_audit_table           ON audit_log(table_name, record_id);

-- ============================================================
-- SECTION 12: SEED DATA — EMISSION FACTORS (ADEME Base Carbone)
-- ============================================================

INSERT INTO emission_factors (category, scope, label, factor_value, unit, source, notes) VALUES

-- Scope 2: Electricity (Tunisia grid mix estimate)
('electricity', 'scope2', 'Électricité réseau tunisien', 0.5590, 'kWh',
 'ADEME Base Carbone / STEG estimate', 'Facteur mix électrique Tunisie 2023 (estimation)'),

-- Scope 1: Fuel combustion
('fuel_combustion', 'scope1', 'Gaz naturel (combustion)', 2.0120, 'm3',
 'ADEME Base Carbone', 'kgCO2e par m³ de gaz naturel'),
('fuel_combustion', 'scope1', 'Fioul domestique (combustion)', 3.1540, 'liter',
 'ADEME Base Carbone', 'kgCO2e par litre de fioul'),

-- Scope 1: Vehicle fuels
('company_vehicles', 'scope1', 'Essence (voiture)', 2.2810, 'liter',
 'ADEME Base Carbone', 'kgCO2e par litre d essence SP95'),
('company_vehicles', 'scope1', 'Diesel (voiture)', 2.5120, 'liter',
 'ADEME Base Carbone', 'kgCO2e par litre de diesel'),

-- Scope 3: Commuting
('commuting_car',        'scope3', 'Voiture individuelle (trajet domicile-campus)', 0.2180, 'km',
 'ADEME Base Carbone', 'kgCO2e par km, moyenne véhicule thermique'),
('commuting_car',        'scope3', 'Covoiturage (2 personnes)', 0.1090, 'km',
 'ADEME Base Carbone', 'kgCO2e par km par passager (2 pers)'),
('commuting_bus',        'scope3', 'Bus (transport en commun)', 0.0290, 'km',
 'ADEME Base Carbone', 'kgCO2e par km passager en bus'),
('commuting_train',      'scope3', 'Train / Metro', 0.0110, 'km',
 'ADEME Base Carbone', 'kgCO2e par km passager en train'),
('commuting_motorcycle', 'scope3', 'Moto / Scooter', 0.1030, 'km',
 'ADEME Base Carbone', 'kgCO2e par km en deux-roues motorisé'),
('commuting_bicycle',    'scope3', 'Vélo / Marche', 0.0000, 'km',
 'ADEME Base Carbone', 'Émissions nulles pour mobilité douce');

-- ============================================================
-- SECTION 13: DEFAULT ADMIN USER (change password immediately)
-- ============================================================

INSERT INTO users (email, full_name, hashed_password, role) VALUES
('admin@ensit.tn', 'ENSIT Admin', crypt('ChangeMe123!', gen_salt('bf')), 'admin');

-- ============================================================
-- SECTION 14: SAMPLE REPORTING PERIOD
-- ============================================================

INSERT INTO reporting_periods (label, start_date, end_date) VALUES
('Année Universitaire 2024-2025', '2024-09-01', '2025-07-31');

-- ============================================================
-- END OF SCHEMA
-- ============================================================
