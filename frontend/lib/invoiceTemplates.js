/**
 * Invoice Templates Registry
 * Manages available invoice templates and their configurations
 */

export const TEMPLATE_TYPES = {
  SIMPLE_GST_1: 'simple_gst_1',
  SIMPLE_GST_1_VARIANT_1: 'simple_gst_1_variant_1',
  SIMPLE_GST_1_VARIANT_2: 'simple_gst_1_variant_2',
  SIMPLE_GST_1_VARIANT_3: 'simple_gst_1_variant_3',
  SIMPLE_GST_TEMP_2: 'simple_gst_temp_2',
};

export const PRINT_SIZES = {
  A4: 'A4',
  A5: 'A5',
  THERMAL_2_INCH: 'thermal_2inch',
  THERMAL_3_INCH: 'thermal_3inch',
};

export const TEMPLATES = [
  {
    id: TEMPLATE_TYPES.SIMPLE_GST_1,
    name: 'Fintranzact GST Invoicing 1',
    description: 'Basic professional template with clean layout',
    category: 'Business',
    previewImage: '/Invoice/Simple GST Invoicing 1.webp',
    default: true,
  },
  {
    id: TEMPLATE_TYPES.SIMPLE_GST_1_VARIANT_1,
    name: 'Fintranzact GST Invoicing 1 - Variant 1',
    description: 'Clean layout with modern styling',
    category: 'Business',
    previewImage: '/Invoice/Simple GST Invoicing 1 (1).webp',
    default: false,
  },
  {
    id: TEMPLATE_TYPES.SIMPLE_GST_1_VARIANT_2,
    name: 'Fintranzact GST Invoicing 1 - Variant 2',
    description: 'Professional format with enhanced spacing',
    category: 'Business',
    previewImage: '/Invoice/Simple GST Invoicing 1 (2).webp',
    default: false,
  },
  {
    id: TEMPLATE_TYPES.SIMPLE_GST_1_VARIANT_3,
    name: 'Fintranzact GST Invoicing 1 - Variant 3',
    description: 'Compact design for detailed invoices',
    category: 'Compact',
    previewImage: '/Invoice/Simple GST Invoicing 1 (3).webp',
    default: false,
  },
  {
    id: TEMPLATE_TYPES.SIMPLE_GST_TEMP_2,
    name: 'Fintranzact GST Invoicing Template 2',
    description: 'Alternative style with different layout',
    category: 'Modern',
    previewImage: '/Invoice/Simple GST Invoicing temp 2.webp',
    default: false,
  },
];

export const PRINT_SIZE_CONFIGS = {
  [PRINT_SIZES.A4]: {
    width: '210mm',
    height: '297mm',
    maxWidth: '210mm',
  },
  [PRINT_SIZES.A5]: {
    width: '148mm',
    height: '210mm',
    maxWidth: '148mm',
  },
  [PRINT_SIZES.THERMAL_2_INCH]: {
    width: '48mm',
    height: 'auto',
    maxWidth: '48mm',
    fontSize: '10px',
  },
  [PRINT_SIZES.THERMAL_3_INCH]: {
    width: '80mm',
    height: 'auto',
    maxWidth: '80mm',
    fontSize: '11px',
  },
};

/**
 * Get template by ID
 */
export function getTemplate(templateId) {
  return TEMPLATES.find(t => t.id === templateId) || TEMPLATES.find(t => t.default);
}

/**
 * Get default template
 */
export function getDefaultTemplate() {
  return TEMPLATES.find(t => t.default) || TEMPLATES[0];
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category) {
  return TEMPLATES.filter(t => t.category === category);
}

/**
 * Get all categories
 */
export function getCategories() {
  return [...new Set(TEMPLATES.map(t => t.category))];
}

