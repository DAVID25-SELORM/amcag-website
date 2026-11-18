// DRAFT questions - NOT reviewed. Import as "pending"; a pharmacist must approve each one.
const R=[];const T=(t,rows)=>rows.forEach(r=>R.push([t,r[0],r[1],r[2],r[3]]));
T("Infection control in the shop",[
["medium","Why should the counter be wiped regularly?",["To reduce germs passed between customers","To make it noisy","To waste time","To chase customers"],"Clean surfaces limit spread."],
["medium","What should you do before preparing an oral rehydration drink for a customer?",["Wash your hands and use clean water","Use dirty cups","Add soil","Skip washing"],"Hygiene matters."],
["medium","How should used tissues and dressings be disposed of?",["In a covered bin with a lining","On the floor","In the drain","In the display case"],"Prevent contamination."],
["medium","Why should a staff member with diarrhoea stay away from handling products?",["They can spread germs","They will be tired","They will eat stock","It is a tradition"],"Illness at work spreads."],
["medium","What is a good practice when testing blood sugar for customers?",["Use a new lancet each time and dispose in a sharps box","Reuse lancets","Share lancets","Wipe lancets on a cloth"],"Never reuse lancets."],
["medium","Why must testing devices like thermometers be cleaned between customers?",["To prevent spreading infection","To change their colour","To make them heavy","It is not necessary"],"Clean after each use."],
["medium","What does PPE stand for?",["Personal protective equipment","Public pharmacy exam","Pharmacy price estimate","Patient prescription entry"],"Gloves and masks are PPE."],
["medium","When should disposable gloves be changed?",["Between customers and after contact with body fluids","Never","Once a week","Only when torn"],"Prevent cross-contamination."],
["medium","What is the best way to keep flies away from the shop?",["Keep it clean, cover waste and food, and keep doors screened","Leave waste open","Leave food out","Keep water standing"],"Pest control prevents contamination."],
["medium","Why should a shop have a handwashing station?",["Staff and customers can clean hands safely","For decoration","For storage","To collect rain"],"Hand hygiene is essential."],
]);
T("Storage and cold chain",[
["medium","Why should medicines be stored away from direct sunlight?",["Light and heat can spoil them","They become brighter","They become tastier","It is a rule of fashion"],"Follow label storage."],
["medium","How should medicines be stored on shelves?",["Off the floor, in order, away from walls and damp","On the floor","Near open drains","Under leaking pipes"],"Good storage protects quality."],
["medium","What does 'store below 25 °C' mean?",["Keep in a cool place not above that temperature","Freeze it","Boil it","Heat it"],"Heat may damage the product."],
["medium","What should you do if the refrigerator holding vaccines or insulin stops working?",["Move items to a working cold storage and seek advice","Ignore it","Leave doors open","Sell them anyway"],"Temperature breaks may spoil products."],
["medium","How often should a fridge temperature be checked and recorded?",["Regularly, such as twice daily","Never","Once a year","Only when it rains"],"Records show control."],
["medium","What is the correct way to store the products that must be kept cold?",["In the refrigerator, not the freezer, unless stated","In the freezer","In sunlight","On the counter"],"Freezing can ruin some products."],
["medium","What does 'FEFO' stand for?",["First expiry, first out","First entry, fast order","Food expiry for outlets","Fixed expiry for orders"],"Sell the earliest expiry first."],
["medium","Why should flammable items such as alcohol rub be stored carefully?",["They can catch fire","They go off","They smell nice","They taste sweet"],"Keep away from heat."],
["medium","Why should medicines never be stored in the bathroom?",["Humidity and heat can damage them","Bathrooms are too clean","It is too cold","It is too dark"],"Choose a cool dry place."],
["medium","What should you do if a pack of tablets looks damp or discoloured?",["Do not sell it; isolate and report to the supplier","Sell it cheaply","Dry it in the sun","Mix with new stock"],"Quality problems must be handled."],
]);
T("Counterfeit and poor-quality medicines",[
["medium","What is a counterfeit medicine?",["A fake product deliberately mislabelled","A cheap generic","A cough sweet","A sample sachet"],"Counterfeits can be dangerous."],
["medium","Which sign may suggest a counterfeit pack?",["Spelling errors, poor printing or different colour from usual","Correct batch number and expiry","A clean pack","An FDA registration number"],"Inspect packs."],
["medium","Where should suspected fake medicines be reported?",["To the FDA or the regulator","To nobody","To the neighbour","On social media only"],"Reporting protects the public."],
["medium","Why should you buy only from licensed suppliers?",["To reduce the risk of fake or poor-quality products","To get free gifts","To avoid receipts","It is a custom"],"Source matters."],
["medium","What should you do with a product you suspect is fake?",["Stop selling, set it aside and report","Sell it quickly","Throw it into the open","Return it silently to the street seller"],"Preserve evidence."],
["medium","Why are unusually cheap deals on medicines a warning sign?",["They may be fake, expired or stolen","They are always good","They are legal","They are tax-free"],"Be careful with offers."],
["medium","What is the effect of a substandard antibiotic on a patient?",["It may not cure and may increase resistance","It always works","It is safe","It is stronger"],"Quality affects outcomes."],
["medium","What does a batch number help with?",["Tracing a product if there is a problem","Telling the price","Measuring dose","Naming the shop"],"Used in recalls."],
]);
T("Prescriptions and dispensing",[
["medium","What should you check on a prescription before supplying?",["Patient details, medicine, strength, dose and prescriber","Only the price","Only the colour of paper","Nothing"],"Verify every part."],
["medium","What should you do if a prescription is unclear or illegible?",["Contact the prescriber or pharmacist to confirm","Guess","Supply anything","Refuse politely and leave"],"Never guess."],
["medium","Why must prescription-only medicines not be sold without a valid prescription?",["They can cause harm without supervision","They taste bad","They are free","They are always weak"],"Follow the law."],
["medium","What does 'Rx' mean?",["Take (a prescription)","Price","Receipt","Reaction"],"Written on prescriptions."],
["medium","What does 'PRN' mean on a prescription?",["As needed","Every night","Before meals","Per rectum only"],"Latin 'pro re nata'."],
["medium","What does 'BD' or 'BID' mean?",["Twice daily","Once daily","Three times daily","Four times daily"],"Bis in die."],
["medium","What does 'TDS' or 'TID' mean?",["Three times daily","Twice daily","Once daily","At night only"],"Ter die sumendum."],
["medium","What does 'OD' mean on a prescription?",["Once daily","Twice daily","Every other day","As needed"],"Check carefully; confirm if unclear."],
["medium","What does 'QDS' or 'QID' mean?",["Four times daily","Twice daily","Once daily","Every six days"],"Quater die sumendum."],
["medium","What does 'stat' mean?",["Immediately","Every day","At night","With food"],"Used for urgent doses."],
["medium","What does 'PO' mean?",["By mouth","By ear","By nose","By skin"],"Per os."],
["medium","What does 'PC' mean on a label?",["After meals","Before meals","With milk","At bedtime"],"Post cibum."],
["medium","What does 'AC' mean on a label?",["Before meals","After meals","At night","Twice daily"],"Ante cibum."],
["medium","What does 'HS' mean?",["At bedtime","Half strength","Hourly","Hospital supply"],"Hora somni."],
["medium","What should you do after dispensing a medicine?",["Label it and explain use, dose and warnings","Send them away quietly","Hide the label","Charge extra"],"Counselling reduces errors."],
["medium","Why should labels be written clearly with the patient's name and dose?",["To prevent mix-ups and mistakes","To look neat only","To cost more","It is not needed"],"Clear labels save lives."],
]);
module.exports=R.map(r=>[r[0],r[1],r[2],r[3],0,r[4]]);
