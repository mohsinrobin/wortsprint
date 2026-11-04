// Operator details for the Privacy page. The pages show a notice while any is empty.
// No postal address yet: the app is free. Before taking money, add an Imprint
// (Impressum, §5 DDG) with a ladungsfähige Anschrift, e.g. a business address.
export const OPERATOR = {
  name: 'MD MOHSIN NUR ROBIN',
  email: 'mihimaanu@gmail.com',
};

export const operatorComplete = Object.values(OPERATOR).every((v) => v.trim() !== '');

/** Last change of the privacy policy, shown on the page. */
export const PRIVACY_UPDATED = '4 November 2026';
