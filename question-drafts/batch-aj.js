// DRAFT questions - NOT reviewed. Import as "pending"; a pharmacist must approve each one.
const R=[];const T=(t,rows)=>rows.forEach(r=>R.push([t,r[0],r[1],r[2],r[3]]));
T("Antibiotic resistance",[
["medium","What is antibiotic resistance?",["Bacteria no longer being killed by antibiotics","Antibiotics becoming sweeter","People refusing antibiotics","Antibiotics expiring"],"Misuse speeds resistance."],
["medium","What increases antibiotic resistance?",["Using antibiotics when not needed or not finishing courses","Handwashing","Vaccination","Using clean water"],"Use only when prescribed."],
["medium","Why should antibiotics not be shared?",["The wrong drug or dose can fail and promote resistance","They taste bad","They are too cheap","They are too fast"],"Antibiotics are for the specific infection."],
["medium","What should you do if a customer stops antibiotics early because they feel well?",["Explain the importance of completing the prescribed course","Agree they are cured","Tell them to double doses","Sell more"],"Follow the prescriber's advice."],
["medium","Which infections do antibiotics treat?",["Bacterial infections","Viral infections like colds","Allergies","Sprains"],"Choose carefully."],
["medium","Why should antibiotics not be added to animal feed without control?",["It contributes to resistance","It makes feed colourful","It is cheap","It stops hunger"],"One Health concern."],
["medium","What does 'broad-spectrum' mean?",["Active against many types of bacteria","Wide pack","Large tablet","Cheap price"],"Use should be guided."],
["medium","What is good antibiotic stewardship?",["Using antibiotics only when needed, correctly and for the right time","Using them for every fever","Using leftovers","Buying without advice"],"Protects future treatment."],
["medium","Why should you not give antibiotics for a sore throat caused by a virus?",["They do not work on viruses","They are too strong","They are too weak","They cause fever"],"Most sore throats are viral."],
["medium","Which action helps stop resistant infections spreading?",["Hand hygiene and infection prevention","Sharing medicines","Keeping unused antibiotics","Taking them without advice"],"Prevention reduces need."],
]);
T("Medicine safety in children",[
["medium","Why should children not take adult medicines?",["Doses and safety differ in children","They taste bad","They are too big","They are free"],"Always use child-appropriate products."],
["medium","What should you check before giving a child any medicine?",["Age, weight, allergies and the correct product","Colour only","Brand only","Price only"],"Doses often depend on weight."],
["medium","Why should a proper measuring device be used for liquid medicines?",["Kitchen spoons vary and can give wrong doses","They are free","They are pink","They are pretty"],"Use the syringe or cup supplied."],
["medium","Where should medicines be kept to avoid child poisoning?",["High up and locked away","On the floor","In reach","In a school bag"],"Child-resistant caps help."],
["medium","What should a parent do if a child swallows an unknown number of tablets?",["Seek emergency help at once and bring the pack","Wait to see","Induce vomiting","Give milk and sleep"],"Do not delay."],
["medium","Why should a child not be given medicine in the dark?",["Wrong medicine or dose may be given","They sleep badly","They cry","It is cold"],"Check the label in good light."],
["medium","What is a safe way to give a bitter liquid to a young child?",["Use a syringe towards the cheek and give slowly","Pour it quickly into the mouth","Force the head back","Mix in the whole bottle of milk"],"Avoid choking."],
["medium","Why should babies not be given herbal drinks and teas for every illness?",["Some are unsafe and may delay proper care","Babies love them","They are free","They cure all"],"Ask a health worker."],
["medium","What should you do if a child vomits soon after taking medicine?",["Ask a pharmacist or health worker about repeating the dose","Give double at once","Skip all treatment","Give alcohol"],"Advice depends on the medicine."],
["medium","What is the main reason to complete a child's prescribed course?",["To fully treat the infection","To finish the bottle","To please the shop","To avoid sugar"],"Follow the course."],
]);
T("Hypertension and heart medicines",[
["medium","Why should blood pressure be checked at rest?",["Activity and stress can raise it","It is cold","The cuff is heavy","Resting has no effect"],"Sit quietly before checking."],
["medium","What should a person do if they get a dry cough on some blood pressure medicines?",["Tell the prescriber; do not just stop","Ignore it","Stop all medicines","Take cough syrup always"],"Alternatives exist."],
["medium","Why should people on diuretics ('water tablets') report severe dizziness or cramps?",["They may be losing too much fluid or salts","It is normal always","It is allergy only","It is flu"],"Seek advice."],
["medium","Why do some heart tablets need regular blood tests?",["To check safety and effect","To waste time","To charge fees","They never do"],"Follow monitoring."],
["medium","What should you tell someone on aspirin for the heart?",["Take as prescribed and do not stop without advice","Stop when pain stops","Double the dose","Share with friends"],"Stopping can raise risk."],
["medium","What is a statin mainly used for?",["Lowering cholesterol","Lowering fever","Treating infection","Easing coughs"],"Prescribed for heart protection."],
["medium","What advice about grapefruit may apply to some medicines?",["It can interact with certain medicines; check the leaflet","It cures hypertension","It is always safe","It is unsafe for all"],"Ask a pharmacist."],
["medium","Why is a salt substitute a concern for some people on certain medicines?",["It can contain potassium that may build up","It is sweet","It is expensive","It causes colour change"],"Check with a pharmacist."],
]);
T("Smoking, alcohol and substances",[
["medium","Why is smoking harmful?",["It damages lungs and heart and raises cancer risk","It improves breathing","It cures cough","It strengthens bones"],"Quitting helps quickly."],
["medium","What can support someone who wants to stop smoking?",["Counselling, support and approved aids","Smoking more","Alcohol","Hiding"],"Support improves success."],
["medium","What is a harm of heavy alcohol use?",["Liver damage, accidents and dependence","Better sleep always","Stronger heart","Faster healing"],"Encourage moderation or help."],
["medium","Why is second-hand smoke harmful to children?",["It increases chest infections and asthma","It is harmless","It improves immunity","It strengthens lungs"],"Keep homes smoke-free."],
["medium","What should you do when a customer seems intoxicated and asks for sedatives?",["Do not supply and suggest safe support","Supply many","Sell alcohol","Ignore"],"Avoid harm."],
["medium","What is a sign of opioid overdose?",["Slow breathing, tiny pupils and unresponsiveness","Sneezing","Itchy eyes","Hunger"],"Emergency care needed."],
["medium","Why should tramadol and similar medicines not be sold without a prescription?",["They can cause dependence and serious harm","They are vitamins","They are sweets","They are antiseptics"],"Follow controlled drug laws."],
["medium","What is a good response to a teenager who asks about using drugs?",["Listen without judging and refer to support services","Shame them","Sell drugs","Ignore them"],"Support and referral."],
]);
module.exports=R.map(r=>[r[0],r[1],r[2],r[3],0,r[4]]);
