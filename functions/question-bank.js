// ================================================================
// AMCAG daily question bank
//
// Each entry: { topic, question, options: [A, B, C, D], answer: index 0-3, explanation, source }
//
// IMPORTANT: Review every question with a pharmacist / AMCAG executive before going live.
// Items whose source is "Pharmacy Council OTC guidelines" or "FDA Ghana" were checked against
// those public pages. Items marked "General practice" are widely accepted professional
// guidance but must be confirmed against the current Ghana Standard Treatment Guidelines (STG),
// Pharmacy Council rules and FDA directives before use. Do not add drug dosing questions
// without checking the STG dosing tables directly.
// ================================================================

const PC = 'Pharmacy Council OTC guidelines (pcghana.org)';
const FDA = 'FDA Ghana (fdaghana.gov.gh)';
const GP = 'General practice - confirm against current STG / Pharmacy Council';

const QUESTIONS = [
  // ---- Scope of practice and the law ----
  {
    topic: 'Scope of practice',
    question: 'Which class of medicines may a licensed Over-the-Counter Medicine Seller (OTCMS) sell?',
    options: ['Class A (prescription-only)', 'Class B (pharmacist list)', 'Class C (over-the-counter)', 'Any class if the customer insists'],
    answer: 2,
    explanation: 'An OTCMS licence covers only Class C / over-the-counter medicines. Class A and B medicines are for pharmacies.',
    source: PC
  },
  {
    topic: 'Scope of practice',
    question: 'A customer asks you for tramadol without a prescription. What should you do?',
    options: ['Sell a small quantity', 'Politely decline and refer them to a prescriber or pharmacy', 'Sell it only if they look genuine', 'Ask another shop to sell it to them'],
    answer: 1,
    explanation: 'Tramadol is a prescription-only medicine and is outside an OTCMS scope. The FDA has also warned that selling unregistered tramadol is a criminal offence.',
    source: FDA
  },
  {
    topic: 'Scope of practice',
    question: 'Where may an OTCMS licence holder sell medicines?',
    options: ['Anywhere in the district', 'At the premises named on the licence', 'On the street if no shop is available', 'At any market with the chief\'s permission'],
    answer: 1,
    explanation: 'The licence applies to the premises named on it. Selling medicines elsewhere is outside the licence.',
    source: PC
  },
  {
    topic: 'Scope of practice',
    question: 'An OTCMS licence expires every year on which date, and by when should it be renewed?',
    options: ['30 June; renew by 31 July', '31 December; renew by 31 January', '31 March; renew by 30 April', 'It never expires'],
    answer: 1,
    explanation: 'The licence expires on 31 December each year and should be renewed by 31 January of the following year.',
    source: PC
  },
  {
    topic: 'Scope of practice',
    question: 'What must you do with your licence at the shop?',
    options: ['Keep it at home safely', 'Display it at the premises', 'Give it to the supplier', 'Only show it if the police ask'],
    answer: 1,
    explanation: 'Licence holders must display the licence at the premises and operate under sanitary conditions.',
    source: PC
  },
  {
    topic: 'Scope of practice',
    question: 'Which body registers medicines so they may be sold in Ghana?',
    options: ['Ghana Education Service', 'Food and Drugs Authority (FDA)', 'Ghana Revenue Authority', 'Ghana Police Service'],
    answer: 1,
    explanation: 'The FDA registers medicines. Selling unregistered products is an offence.',
    source: FDA
  },
  {
    topic: 'Scope of practice',
    question: 'Who may sell Class B (pharmacist list) medicines without a prescription?',
    options: ['Any shop owner', 'An OTCMS', 'A pharmacist in a licensed pharmacy', 'Any trained salesperson'],
    answer: 2,
    explanation: 'Class B medicines can be supplied by a pharmacist in a pharmacy. They are outside the OTCMS scope.',
    source: PC
  },
  {
    topic: 'Scope of practice',
    question: 'A salesperson in a licensed OTC shop sells a Class A medicine "just once" for a regular customer. What is this?',
    options: ['A kindness', 'Practising outside the licence scope', 'Allowed for regular customers', 'Allowed if the customer pays more'],
    answer: 1,
    explanation: 'Selling outside the licensed class is practising outside scope and can lead to sanctions.',
    source: PC
  },

  // ---- Product quality, storage and stock ----
  {
    topic: 'Stock management',
    question: 'What does FEFO mean in stock management?',
    options: ['First Expired, First Out', 'Fast Entry, Fast Order', 'First Fee, First Order', 'Fixed Expiry, Fixed Order'],
    answer: 0,
    explanation: 'FEFO means products that expire first are sold first, which reduces expired stock.',
    source: GP
  },
  {
    topic: 'Stock management',
    question: 'You find expired medicines on the shelf. What is the correct action?',
    options: ['Sell them cheaply', 'Remove, separate and dispose of them properly', 'Change the expiry date label', 'Give them to a neighbour'],
    answer: 1,
    explanation: 'Expired medicines must never be sold. Remove them, keep them separate, and dispose of them as required.',
    source: GP
  },
  {
    topic: 'Stock management',
    question: 'A label shows an expiry date of 03/2027. Until when can the medicine normally be used?',
    options: ['Start of March 2027', 'End of March 2027', 'End of April 2027', 'End of 2027'],
    answer: 1,
    explanation: 'When only month and year are shown, the product is normally usable until the last day of that month.',
    source: GP
  },
  {
    topic: 'Stock management',
    question: 'Which storage conditions suit most tablets and capsules unless the label says otherwise?',
    options: ['Direct sunlight on a window ledge', 'Cool, dry place away from direct sunlight', 'Inside a hot car', 'Next to the cooker'],
    answer: 1,
    explanation: 'Heat, humidity and sunlight can spoil medicines. Follow the label storage instructions.',
    source: GP
  },
  {
    topic: 'Stock management',
    question: 'What is the usual storage temperature range for medicines that must be kept in the fridge?',
    options: ['-10 to 0 C', '2 to 8 C', '15 to 20 C', '25 to 35 C'],
    answer: 1,
    explanation: 'Refrigerated medicines are normally stored at 2 to 8 C. Do not freeze them unless the label says so.',
    source: GP
  },
  {
    topic: 'Stock management',
    question: 'From whom should you buy your stock?',
    options: ['Anyone offering the lowest price', 'Licensed and registered suppliers', 'Street hawkers', 'Anyone who delivers quickly'],
    answer: 1,
    explanation: 'Buy only from licensed suppliers and keep invoices. This protects customers from fake and unregistered products.',
    source: FDA
  },
  {
    topic: 'Stock management',
    question: 'Which is a warning sign that a medicine may be falsified?',
    options: ['Product has an FDA registration number', 'Misspelt words and poor-quality printing on the pack', 'Sealed and intact packaging', 'Batch number and expiry date clearly printed'],
    answer: 1,
    explanation: 'Spelling errors, poor printing, missing registration number, or damaged seals are warning signs. Report suspicious products.',
    source: FDA
  },
  {
    topic: 'Stock management',
    question: 'You suspect a product is fake or unregistered. What should you do?',
    options: ['Sell it quickly', 'Stop selling it and report to the FDA', 'Hide it in the store', 'Return it to the hawker'],
    answer: 1,
    explanation: 'Stop selling and report to the FDA so the product can be investigated.',
    source: FDA
  },
  {
    topic: 'Hygiene',
    question: 'When should you wash your hands in the shop?',
    options: ['Only at the end of the day', 'Before handling medicines and after using the toilet', 'Never, gloves are enough', 'Only when visibly dirty'],
    answer: 1,
    explanation: 'Clean hands protect both you and the customer. Wash before handling medicines and after any contamination.',
    source: GP
  },

  // ---- Counselling and safe use ----
  {
    topic: 'Counselling',
    question: 'Which information should you always give when handing over a medicine?',
    options: ['Only the price', 'Dose, how often, how long, common side effects, and storage', 'The supplier\'s name', 'Nothing, the label is enough'],
    answer: 1,
    explanation: 'Good counselling covers how much, how often, for how long, what to watch for, and how to store the medicine.',
    source: GP
  },
  {
    topic: 'Counselling',
    question: 'Before recommending any medicine to a woman of child-bearing age, what should you ask?',
    options: ['Her favourite colour', 'Whether she is pregnant or breastfeeding', 'Where she works', 'Her church'],
    answer: 1,
    explanation: 'Many medicines are unsafe in pregnancy or breastfeeding. Always ask, and refer when unsure.',
    source: GP
  },
  {
    topic: 'Counselling',
    question: 'A customer says they take other medicines regularly. What should you do before selling anything?',
    options: ['Ignore it', 'Ask what they take and check for interactions, refer if unsure', 'Sell the most expensive item', 'Tell them to stop their other medicines'],
    answer: 1,
    explanation: 'Interactions can be dangerous. Ask about other medicines and refer when you are not sure.',
    source: GP
  },
  {
    topic: 'Counselling',
    question: 'Why should patients not share antibiotics with family or friends?',
    options: ['They are too expensive', 'The wrong drug or dose can harm and promotes resistance', 'They taste bad', 'It is only a custom'],
    answer: 1,
    explanation: 'Antibiotics must match the infection and be taken as prescribed. Misuse promotes antibiotic resistance.',
    source: GP
  },
  {
    topic: 'Counselling',
    question: 'A customer has a common cold and asks for an antibiotic. What is the best advice?',
    options: ['Sell any antibiotic', 'Explain colds are usually viral and antibiotics do not help; advise rest, fluids and symptom relief', 'Sell two types to be safe', 'Tell them to take a double dose'],
    answer: 1,
    explanation: 'Colds are caused by viruses. Antibiotics do not treat them and misuse drives resistance.',
    source: GP
  },
  {
    topic: 'Counselling',
    question: 'Which antihistamine side effect should you warn customers about?',
    options: ['Drowsiness - take care when driving or using machines', 'Hair growth', 'Stronger eyesight', 'Faster running'],
    answer: 0,
    explanation: 'Some antihistamines cause drowsiness. Warn customers about driving and operating machinery.',
    source: GP
  },
  {
    topic: 'Counselling',
    question: 'A customer wants two products for a cold and both contain paracetamol. What is the risk?',
    options: ['No risk', 'Taking too much paracetamol, which can damage the liver', 'The medicines will cancel out', 'Only a bad taste'],
    answer: 1,
    explanation: 'Many cold and flu products contain paracetamol. Doubling up can cause an overdose. Check ingredients.',
    source: GP
  },
  {
    topic: 'Counselling',
    question: 'Why should adults avoid taking more than the labelled dose of paracetamol?',
    options: ['It tastes bitter', 'Overdose can cause serious liver damage', 'It makes teeth yellow', 'It has no effect'],
    answer: 1,
    explanation: 'Paracetamol overdose is a common cause of liver injury. Always follow the label dose and maximum daily limit.',
    source: GP
  },
  {
    topic: 'Counselling',
    question: 'Why should aspirin generally be avoided in children and teenagers with fever?',
    options: ['It is too cheap', 'It is linked to a rare serious illness called Reye\'s syndrome', 'It stains clothes', 'It lasts too long'],
    answer: 1,
    explanation: 'Aspirin in children with viral illness has been linked to Reye\'s syndrome. Choose a safer option and refer when unsure.',
    source: GP
  },
  {
    topic: 'Counselling',
    question: 'A customer with a history of stomach ulcers asks for an ibuprofen-type pain reliever. What is best?',
    options: ['Sell it, it is fine', 'Avoid it and refer, as such medicines can irritate the stomach', 'Sell double the quantity', 'Advise taking it on an empty stomach'],
    answer: 1,
    explanation: 'NSAIDs can irritate or bleed the stomach lining. Refer people with ulcer history.',
    source: GP
  },
  {
    topic: 'Counselling',
    question: 'A customer with high blood pressure wants a decongestant for a blocked nose. What should you do?',
    options: ['Sell any decongestant', 'Be cautious - some decongestants can raise blood pressure; refer or advise a safer option', 'Tell them to stop BP tablets', 'Sell two boxes'],
    answer: 1,
    explanation: 'Some oral decongestants can raise blood pressure. Check and refer when unsure.',
    source: GP
  },
  {
    topic: 'Counselling',
    question: 'How should you handle a customer\'s health information?',
    options: ['Share it with neighbours', 'Keep it confidential', 'Post it online', 'Tell their employer'],
    answer: 1,
    explanation: 'Customer health information is private and must be kept confidential.',
    source: GP
  },

  // ---- Common conditions and referral ----
  {
    topic: 'Common conditions',
    question: 'What is the recommended first step for a person with fever suspected to be malaria?',
    options: ['Take any antibiotic', 'Get tested (RDT or microscopy) before treatment', 'Drink only herbal tea', 'Wait one week'],
    answer: 1,
    explanation: 'The national policy is "test before you treat". Confirm malaria with a test and treat with the recommended medicine.',
    source: GP
  },
  {
    topic: 'Common conditions',
    question: 'Which is the best way to prevent malaria in a household?',
    options: ['Sleep under a treated mosquito net', 'Close the windows during the day only', 'Drink more water', 'Avoid fruit'],
    answer: 0,
    explanation: 'Sleeping under an insecticide-treated net and removing standing water reduce mosquito bites.',
    source: GP
  },
  {
    topic: 'Common conditions',
    question: 'What is the first-line approach for a child with watery diarrhoea?',
    options: ['Stop all fluids', 'Oral rehydration solution (ORS), with zinc as advised, and refer for danger signs', 'Give an antibiotic to every child', 'Give only cola'],
    answer: 1,
    explanation: 'Dehydration is the main danger. ORS replaces fluids and salts; zinc shortens the illness. Refer if there is blood, vomiting, or lethargy.',
    source: GP
  },
  {
    topic: 'Common conditions',
    question: 'How long should a made-up ORS solution be kept before throwing away the rest?',
    options: ['Up to 24 hours', 'One week', 'One month', 'Forever'],
    answer: 0,
    explanation: 'Prepare ORS with clean water in the volume shown on the sachet and discard leftovers after 24 hours.',
    source: GP
  },
  {
    topic: 'Common conditions',
    question: 'A baby under 3 months has a fever. What should you do?',
    options: ['Sell paracetamol and send home', 'Refer immediately for medical assessment', 'Wait 3 days', 'Give an antibiotic'],
    answer: 1,
    explanation: 'Fever in very young babies can signal serious infection and needs urgent medical care.',
    source: GP
  },
  {
    topic: 'Common conditions',
    question: 'Which of these is a reason to refer a customer to a clinic or hospital?',
    options: ['Mild headache for one hour', 'Difficulty breathing', 'A single sneeze', 'Slightly dry lips'],
    answer: 1,
    explanation: 'Difficulty breathing, blood in stool or vomit, severe chest pain, seizures, and confusion all need urgent medical care.',
    source: GP
  },
  {
    topic: 'Common conditions',
    question: 'A child\'s fever has lasted more than 3 days despite treatment. What should you advise?',
    options: ['Keep treating at home', 'See a health worker for assessment', 'Double the dose', 'Try another shop'],
    answer: 1,
    explanation: 'Fever that lasts more than a few days needs a proper assessment.',
    source: GP
  },
  {
    topic: 'Common conditions',
    question: 'When counselling about children\'s medicines, how should doses be chosen?',
    options: ['Guess based on size', 'By the age or weight bands on the label or guideline', 'Use the adult dose', 'Ask the child'],
    answer: 1,
    explanation: 'Children\'s doses are based on age or weight. Never guess or use adult doses.',
    source: GP
  },

  // ---- Reporting and professionalism ----
  {
    topic: 'Safety reporting',
    question: 'A customer reports a serious reaction after using a medicine. Where can you report it?',
    options: ['Nowhere', 'To the FDA Ghana adverse reaction reporting system', 'To a friend', 'On social media only'],
    answer: 1,
    explanation: 'Suspected adverse drug reactions should be reported to the FDA so safety problems can be detected.',
    source: FDA
  },
  {
    topic: 'Professionalism',
    question: 'Why should you keep supplier invoices and stock records?',
    options: ['To fill drawers', 'To trace products and show your stock is from legal sources', 'No reason', 'Only for tax in December'],
    answer: 1,
    explanation: 'Records help trace products in a recall and prove your stock comes from licensed suppliers.',
    source: GP
  },
  {
    topic: 'Professionalism',
    question: 'A customer pressures you to sell a prescription-only medicine. What is the professional response?',
    options: ['Give in to keep the customer', 'Stay firm, explain why, and refer', 'Sell it at a higher price', 'Ask them to come back at night'],
    answer: 1,
    explanation: 'Protecting patient safety and your licence is more important than one sale.',
    source: PC
  },
  {
    topic: 'Professionalism',
    question: 'Which Act is cited in the Pharmacy Council guidelines for the OTC seller scope?',
    options: ['Health Professions Regulatory Bodies Act, 2013 (Act 857)', 'Road Traffic Act', 'Companies Act', 'Education Act'],
    answer: 0,
    explanation: 'The guidelines link OTC seller scope to section 94(1)(a) of Act 857.',
    source: PC
  },
  {
    topic: 'Professionalism',
    question: 'Which body licenses OTC medicine sellers in Ghana?',
    options: ['Pharmacy Council', 'Ghana Football Association', 'Electoral Commission', 'Ghana Standards Authority only'],
    answer: 0,
    explanation: 'The Pharmacy Council licenses OTC medicine sellers and pharmacies.',
    source: PC
  }
];

module.exports = { QUESTIONS };
