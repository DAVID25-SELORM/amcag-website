// DRAFT questions - NOT reviewed. Import as "pending"; a pharmacist must approve each one.
const R=[];const T=(t,rows)=>rows.forEach(r=>R.push([t,r[0],r[1],r[2],r[3]]));
T("Myths and facts II",[
["easy","True or false: antibiotics cure colds and flu.",["False; colds and flu are viral","True","True for children only","True in the rainy season"],"Antibiotics do not work on viruses."],
["easy","True or false: you can catch malaria from drinking dirty water.",["False; it is spread by mosquitoes","True","True in the dry season","True in children only"],"Dirty water causes other diseases."],
["medium","True or false: a higher dose always works faster.",["False; it may cause harm","True","True for adults","True for tablets"],"Follow the label."],
["medium","True or false: injections are always stronger than tablets.",["False; the best route depends on the need","True","True for all illness","True for children"],"Use medicines correctly."],
["medium","True or false: natural products are always safe.",["False; some can cause harm","True","True if herbal","True if cheap"],"Check quality and interactions."],
["medium","True or false: you should stop blood pressure tablets when you feel fine.",["False; continue and review with the prescriber","True","True after a month","True in the dry season"],"High blood pressure is often silent."],
["medium","True or false: eating sugar causes diabetes directly in every case.",["False; causes are more complex, though diet matters","True","True only for men","True for children only"],"Risk comes from several factors."],
["medium","True or false: you can tell if someone has HIV by looking at them.",["False; testing is needed","True","True if thin","True if tired"],"Do not stigmatise."],
["medium","True or false: a person with epilepsy is contagious.",["False; epilepsy cannot be caught","True","True by touch","True by sharing food"],"Epilepsy is a brain condition."],
["medium","True or false: malaria always causes high fever with shaking chills.",["False; symptoms vary, so testing is important","True","True for all","True for adults only"],"Do not rely on symptoms alone."],
["medium","True or false: drinking lots of alcohol clears a cough.",["False; it can cause harm","True","True with sugar","True with lemon"],"Alcohol does not treat infections."],
["medium","True or false: expired medicines are always poisonous.",["False; but they may not work or be safe, so do not use them","True","True after one day","True only for syrups"],"Dispose properly."],
["medium","True or false: pregnant women should avoid all medicines without advice.",["True, always check with a health worker first","False","False for painkillers","False for herbs"],"Some medicines harm the baby."],
["medium","True or false: you can share a needle safely if you clean it with water.",["False; never share needles","True","True with soap","True with alcohol"],"Sharing spreads infection."],
["medium","True or false: skin-lightening creams are always safe.",["False; many are harmful","True","True when expensive","True if foreign"],"Unregulated creams can damage skin."],
["medium","True or false: handwashing prevents many infections.",["True","False","False in hot weather","False for adults"],"It is one of the best protections."],
]);
T("Vitamins and supplements",[
["medium","What is vitamin C commonly found in?",["Citrus fruits and many vegetables","Sugar","Salt","Rice only"],"Eat fruits and vegetables."],
["medium","What can too much vitamin A cause?",["Toxicity, especially in pregnancy","Better vision always","Stronger hair","Faster healing"],"More is not better."],
["medium","What is vitamin D important for?",["Bone health and calcium absorption","Digestion of sugar","Hearing","Hair colour"],"Sunlight helps make it."],
["medium","Which vitamin is vital for blood clotting?",["Vitamin K","Vitamin C","Vitamin B12","Vitamin A"],"Newborns receive vitamin K."],
["medium","Which deficiency causes beriberi?",["Vitamin B1 (thiamine)","Vitamin C","Vitamin D","Vitamin A"],"Seen with poor diet and alcohol."],
["medium","What is zinc used for in children with diarrhoea?",["It reduces the duration and severity when given with ORS as advised","It stops all diarrhoea instantly","It is a laxative","It cures malaria"],"Part of recommended care."],
["medium","What is iodine important for?",["Thyroid function","Hearing","Skin colour","Bone growth only"],"Use iodised salt."],
["medium","What is a risk of taking many supplements at once?",["Overdose and interactions","Better health always","Faster growth","Stronger bones always"],"Ask a pharmacist."],
["medium","Which supplement is commonly advised in early pregnancy?",["Folic acid","Vitamin K","Vitamin B1 only","Zinc only"],"Take as advised."],
["medium","Who may need vitamin B12 supplements?",["People who eat no animal foods or have absorption problems","Everyone daily","Only children","Nobody"],"Ask a health worker."],
]);
T("Sleep and lifestyle",[
["medium","How many hours of sleep do most adults need?",["About 7 to 9 hours","About 2 hours","About 14 hours","None"],"Sleep supports health."],
["medium","What helps people fall asleep naturally?",["A regular routine, dark quiet room and less caffeine late in the day","Coffee at bedtime","Loud music","Screens until late"],"Good sleep hygiene."],
["medium","Why should sleeping tablets not be used long-term without advice?",["They can cause dependence and drowsiness","They are free","They strengthen sleep forever","They cure insomnia"],"Seek assessment."],
["medium","What is a healthy way to reduce weight?",["Balanced diet and regular activity","Starving","Using slimming pills freely","Skipping all meals"],"Gradual change is safer."],
["medium","Why are slimming pills and teas risky?",["Some contain unsafe or unapproved ingredients","They are always safe","They are always cheap","They always work"],"Check with a pharmacist."],
["medium","How often should adults aim to be active?",["Most days of the week","Never","Once a year","Only on weekends only"],"Aim for regular movement."],
["medium","Why is sitting for many hours harmful?",["It raises the risk of heart disease and diabetes","It helps digestion","It builds muscle","It lowers blood pressure"],"Move regularly."],
["medium","What is a healthy way to handle stress at work?",["Take breaks, talk with others and plan tasks","Skip meals","Drink heavily","Avoid sleep"],"Balance matters."],
]);
T("Pharmacy shop business",[
["medium","Why should you display the price of items?",["It builds trust and avoids disputes","It confuses customers","It is illegal","It lowers sales"],"Transparent pricing."],
["medium","What does 'turnover' mean in a shop?",["Total sales over a period","Staff leaving","Stock thrown away","Price discount"],"Measures sales."],
["medium","What is 'gross profit'?",["Sales minus cost of goods sold","Sales plus cost","Cost minus sales","Rent only"],"Before other expenses."],
["medium","What is a sensible way to price an item?",["Include cost, expenses and a fair margin","Guess","Copy random prices","Use the lowest price always"],"Keep margins healthy."],
["medium","Why should you separate personal and business money?",["To know the real performance of the business","To confuse yourself","It is illegal","It lowers profit"],"Good money habits."],
["medium","What is dead stock?",["Items that do not sell","Fast-selling items","New items","Free items"],"Avoid overstocking."],
["medium","Why should you avoid giving credit to many customers?",["It can cause cash problems if not repaid","It always raises profit","It builds loyalty only","It is required"],"Manage credit carefully."],
["medium","What is a good way to keep staff motivated?",["Fair pay, training and respect","Shouting","Withholding pay","Ignoring them"],"Good teams serve better."],
]);
module.exports=R.map(r=>[r[0],r[1],r[2],r[3],0,r[4]]);
