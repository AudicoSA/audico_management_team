/**
 * Use Case Classifier for Products
 * Automatically categorizes products based on name, category, and brand
 *
 * Use Cases:
 * - Home: Residential/consumer products
 * - Commercial: Business/retail/hospitality
 * - Office: Conference/boardroom
 * - Club: DJ/PA/nightclub
 * - Both: Works in multiple contexts
 * - car_audio: Always excluded from consultations
 */
export type UseCase = 'Home' | 'Commercial' | 'Office' | 'Club' | 'Both' | 'car_audio';
interface ClassifierInput {
    productName: string;
    categoryName?: string;
    brand?: string;
    description?: string;
}
/**
 * Classify a product into a use case category
 */
export declare function classifyUseCase(input: ClassifierInput): UseCase;
/**
 * Check if a product should be excluded from AI consultations
 * (car_audio products are always excluded)
 */
export declare function shouldExcludeFromConsultation(useCase: UseCase): boolean;
declare const _default: {
    classifyUseCase: typeof classifyUseCase;
    shouldExcludeFromConsultation: typeof shouldExcludeFromConsultation;
};
export default _default;
//# sourceMappingURL=use-case-classifier.d.ts.map