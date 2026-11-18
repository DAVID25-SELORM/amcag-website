// DRAFT questions - NOT reviewed. Import as "pending"; a pharmacist must approve each one.
// Row: [topic, difficulty, question, [A,B,C,D], answerIndex(0-3), explanation]
module.exports = [
// ---- Drug interactions and safe combinations ----
["Medicine interactions","medium","Why should tetracycline-type antibiotics generally not be taken together with milk or antacids?",["They can reduce absorption of the antibiotic","They increase the taste","They cause sleep","They make it stronger"],0,"Calcium, magnesium and aluminium can bind the antibiotic, so follow the label for spacing."],
["Medicine interactions","medium","What is a sensible advice about antacids and other medicines?",["Take them at a different time as advised because antacids can affect absorption","Take together always","Take with alcohol","Take as many as possible"],0,"Antacids can change how other medicines are absorbed."],
["Medicine interactions","medium","Why is mixing alcohol with sedating medicines risky?",["It can cause excess drowsiness and slow breathing","It improves sleep safely","It cures anxiety","It makes tablets stronger always"],0,"Alcohol adds to sedation."],
["Medicine interactions","medium","What should you ask a person to tell you before you recommend a new medicine?",["Their current medicines, supplements and herbal products","Their favourite music","Their address","Their salary"],0,"This helps spot interactions."],
["Medicine interactions","hard","Why should two products that both contain paracetamol not be taken together?",["The total can exceed a safe daily amount","They cancel out","They taste bad","They turn the tablets yellow"],0,"Duplicating the same ingredient raises the risk of overdose."],
["Medicine interactions","medium","Which medicines may be affected by taking them with iron tablets?",["Some antibiotics and thyroid medicines","Vitamin D drops","Water","Plasters"],0,"Iron can bind to some medicines. Ask a pharmacist about spacing."],
["Medicine interactions","medium","What should a customer on a blood-thinning medicine do before buying a painkiller?",["Ask a pharmacist or doctor because some painkillers increase bleeding risk","Buy aspirin freely","Double the blood thinner","Stop the blood thinner"],0,"Some painkillers interact with blood thinners."],
["Medicine interactions","medium","What is a side effect?",["An unwanted effect of a medicine that may be expected or occasional","The main effect of a medicine","A pack defect","A price change"],0,"Some side effects are mild and some need attention."],
["Medicine interactions","medium","What is the difference between a side effect and an allergy?",["An allergy is an immune reaction and can be dangerous, while a side effect is a known effect of the medicine","They are the same","Allergies are always harmless","Side effects are always allergies"],0,"Allergic reactions need prompt attention."],
["Medicine interactions","easy","What is a generic medicine?",["A medicine with the same active ingredient as a brand but sold under its generic name","A fake medicine","A herbal drink","A medicine without a label"],0,"Generics contain the same active ingredient and strength as the brand when approved."],
["Medicine interactions","medium","Why might a customer be confused about two different brands of the same medicine?",["Both may contain the same active ingredient","Brands never contain active ingredients","Brands are always different medicines","Brands are the same colour"],0,"Check active ingredients."],
["Medicine interactions","medium","What can you advise about taking medicines with grapefruit juice?",["Check the label or ask a pharmacist, because some medicines are affected","It is always fine","It makes all medicines safer","Always drink it"],0,"Grapefruit can affect some medicines."],
["Medicine interactions","medium","What should you advise someone who feels dizzy after starting a new blood pressure medicine?",["Rise slowly, and contact the prescriber if it continues","Stop all medicines forever","Double the dose","Drive immediately"],0,"Dizziness can be a side effect that should be reported."],
["Medicine interactions","medium","Why should smokers be asked about smoking when buying some medicines?",["Smoking can affect how some medicines work and the risks of others","Smokers get discounts","It is rude","It does not matter"],0,"Smoking status can influence safety."],

// ---- Abbreviations and dosage terms ----
["Terms and abbreviations","easy","What does 'OD' mean on a prescription label?",["Once daily","Overdose","Out of date","Over the door"],0,"OD is commonly used to mean once daily."],
["Terms and abbreviations","easy","What does 'BD' or 'BID' mean?",["Twice daily","Before dinner","By day only","Bad dose"],0,"BD means twice daily."],
["Terms and abbreviations","medium","What does 'TDS' or 'TID' mean?",["Three times daily","Ten days supply","Take during sleep","Tablet dose strong"],0,"TDS means three times a day."],
["Terms and abbreviations","medium","What does 'PO' mean on a prescription?",["By mouth","Post office","Per order","Pharmacy only"],0,"PO means oral route."],
["Terms and abbreviations","medium","What does 'topical' mean on a label?",["For use on the skin","Taken by mouth","Injected","Inhaled"],0,"Topical medicines are applied on the skin."],
["Terms and abbreviations","medium","What does 'nocte' or 'at night' on a label mean?",["Take at bedtime","Take in the morning only","Take every hour","Take with lunch"],0,"This means taking the medicine at night."],
["Terms and abbreviations","medium","What does 'stat' mean?",["Immediately","Slowly","Statistics","Weekly"],0,"Stat means give at once."],
["Terms and abbreviations","medium","What does 'contraindicated' mean?",["Should not be used in a particular situation because it may cause harm","Strongly recommended","Cheaper","Out of stock"],0,"A contraindication means the medicine should be avoided."],
["Terms and abbreviations","medium","What is an 'indication' of a medicine?",["The condition it is used to treat","A warning","A price","A colour"],0,"The indication is what the medicine is used for."],
["Terms and abbreviations","medium","What does 'dosage form' mean?",["The physical form of a medicine such as tablet, syrup or cream","The price list","The brand name","The shop name"],0,"The form affects how the medicine is used."],
["Terms and abbreviations","medium","What is the difference between a syrup and a suspension?",["A suspension contains particles that settle and must be shaken","They are identical","Syrups are injected","Suspensions are creams"],0,"Shake suspensions before use."],
["Terms and abbreviations","medium","What is the difference between a cream and an ointment?",["Ointments are greasier, while creams are lighter and water-based","They are identical","Creams are taken orally","Ointments are inhaled"],0,"Different bases suit different skin conditions."],
["Terms and abbreviations","medium","What does 'enteric-coated' mean?",["A coating that helps the tablet pass the stomach before releasing medicine","A tablet to chew","A tablet to dissolve in water only","A tablet with sugar only"],0,"Do not crush enteric-coated tablets unless advised."],
["Terms and abbreviations","hard","What does 'half-life' mean in simple terms?",["The time for the amount of medicine in the body to fall by half","Half the price","Half the dose","Half the shelf life"],0,"Half-life relates to how often a medicine must be taken."],

// ---- Medicine calculations ----
["Medicine calculations","medium","A syrup contains 100 mg in 5 mL. How many mg are in 15 mL?",["300 mg","150 mg","500 mg","100 mg"],0,"15 mL is three times 5 mL, so 3 x 100 mg equals 300 mg."],
["Medicine calculations","medium","A tablet contains 500 mg. How many tablets are needed for a 1.5 g dose?",["3","2","5","15"],0,"1.5 g equals 1500 mg, divided by 500 mg equals 3 tablets."],
["Medicine calculations","hard","A child needs 4 mL of a syrup three times daily for 5 days. How many mL are needed in total?",["60 mL","20 mL","30 mL","12 mL"],0,"4 mL x 3 x 5 days equals 60 mL."],
["Medicine calculations","medium","A pack has 30 tablets. A person takes one tablet twice daily. How many days will the pack last?",["15","30","10","60"],0,"Two tablets a day, so 30 divided by 2 equals 15 days."],
["Medicine calculations","medium","How many millilitres are in 1 litre?",["1000","100","10","10000"],0,"1 litre equals 1000 mL."],
["Medicine calculations","medium","How many micrograms (mcg) are in 1 mg?",["1000","100","10","1"],0,"1 mg equals 1000 mcg."],
["Medicine calculations","hard","A cream is labelled 2%. How many grams of active ingredient are in 50 g of cream?",["1 g","2 g","0.1 g","10 g"],0,"2% means 2 g in 100 g, so 50 g contains 1 g."],
["Medicine calculations","medium","A bottle holds 100 mL. A dose is 5 mL. How many full doses are in the bottle?",["20","10","50","5"],0,"100 divided by 5 equals 20."],
["Medicine calculations","medium","A tablet strip of 10 costs GHS 5. How much does one tablet cost?",["GHS 0.50","GHS 5.00","GHS 1.50","GHS 0.05"],0,"5 divided by 10 equals 0.50."],
["Medicine calculations","hard","A customer wants 14 tablets. Each pack has 10 tablets and you must sell whole packs only. How many packs do they need?",["2","1","3","14"],0,"Two packs give 20 tablets and cover the need."],
["Medicine calculations","medium","What is 25% of 200 mg?",["50 mg","25 mg","100 mg","75 mg"],0,"One quarter of 200 is 50."],
["Medicine calculations","medium","A day has 24 hours. If a medicine is taken every 8 hours, how many doses are taken in a day?",["3","2","4","8"],0,"24 divided by 8 equals 3."],

// ---- Medicine classification ----
["Classification of medicines","medium","Which statement about Class C (OTC) medicines is correct?",["They are suitable for sale without a prescription under proper advice","They always need a doctor's signature","They are illegal","They are only for animals"],0,"Class C medicines can be sold without a prescription."],
["Classification of medicines","medium","Which statement about prescription-only medicines is correct?",["They may only be supplied with a valid prescription","They can be sold to anyone","They are the same as vitamins","They are free"],0,"Prescription-only medicines need a prescription."],
["Classification of medicines","medium","Why are some medicines restricted to pharmacist supply or prescription?",["Because they carry higher risks and need professional supervision","To raise prices","To confuse customers","For decoration"],0,"Higher-risk medicines need professional oversight."],
["Classification of medicines","medium","Which of these is usually available without a prescription for mild pain?",["Paracetamol","Injectable antibiotics","Strong opioid painkillers","Chemotherapy"],0,"Paracetamol is a common OTC pain reliever."],
["Classification of medicines","hard","If you are unsure of the classification of a medicine, what should you do?",["Check the current regulatory list or ask a pharmacist before selling","Sell it anyway","Guess","Ask the customer to decide"],0,"Classification rules must be followed."],
];
