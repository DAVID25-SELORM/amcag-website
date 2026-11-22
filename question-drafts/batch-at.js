// DRAFT questions - NOT reviewed. Import as "pending"; a pharmacist must approve each one.
const R=[];const T=(t,rows)=>rows.forEach(r=>R.push([t,r[0],r[1],r[2],r[3]]));
T("Medicine labels and leaflets",[
["medium","Where on a medicine pack do you usually find the batch number?",["On the printed pack or carton near the expiry date","Inside the tablet","On the shop wall","On the receipt only"],"Batch numbers help with recalls."],
["medium","Why is the batch number important?",["It helps trace a product if there is a problem","It shows the price","It shows the colour","It shows the shop"],"Used in recalls."],
["medium","What does 'MFG' on a pack stand for?",["Manufacturing date","Maximum dose","Medicine for gums","Main formula guide"],"Check with the expiry date."],
["medium","What does 'EXP' on a pack stand for?",["Expiry date","Extra pack","Export","Express dose"],"Do not use after it."],
["medium","What is the package leaflet for?",["Information on use, side effects and warnings","Decoration","Advertising only","Price"],"Read before use."],
["medium","What does 'Rx' commonly indicate?",["A prescription medicine","A vitamin","A food","A cosmetic"],"Needs a prescription."],
["medium","What does 'for external use only' mean?",["Do not swallow it","Swallow it","Use in the eye","Inject it"],"Apply to the skin only."],
["medium","What does 'shake well before use' tell you?",["Ingredients may settle and need mixing","The pack is broken","The medicine is old","It is hot"],"Ensures an even dose."],
["medium","What does 'keep out of reach of children' protect against?",["Accidental poisoning","Sunlight","Heat","Theft"],"Store safely."],
["medium","What does 'protect from light' mean?",["Store in the original container away from light","Keep it in sunlight","Heat it","Freeze it"],"Light can spoil some medicines."],
["medium","What does 'use within 28 days of opening' tell you?",["Discard after that time even if unused","Use any time","Freeze it","Mix it"],"Applies to some liquids and drops."],
["medium","What does 'POM' stand for?",["Prescription-only medicine","Pharmacy over measure","Public oral medicine","Pain only medicine"],"Needs a valid prescription."],
]);
T("Medicine dosage forms",[
["medium","What is a capsule?",["A medicine in a soluble shell","A cream","A syrup","A patch"],"Swallow whole unless told otherwise."],
["medium","What is an ointment?",["A greasy preparation applied to the skin","A tablet","A drink","An injection"],"Good for dry skin."],
["medium","What is a lotion?",["A thin liquid for the skin","A tablet","A capsule","A suppository"],"Spreads easily."],
["medium","What is a suspension?",["A liquid with undissolved particles that must be shaken","A clear solution","A solid","A powder"],"Shake before use."],
["medium","What is an elixir?",["A sweet liquid containing alcohol","A tablet","A patch","An ointment"],"Check alcohol content for children."],
["medium","What is an enteric-coated tablet designed to do?",["Resist stomach acid and dissolve in the intestine","Dissolve at once in the mouth","Melt on the skin","Float"],"Do not crush."],
["medium","What is a lozenge?",["A medicine that dissolves slowly in the mouth","A swallowed capsule","An eye drop","A suppository"],"Used for throat relief."],
["medium","What is a transdermal patch?",["A patch delivering medicine through the skin","A bandage only","A tablet","A syrup"],"Rotate sites as advised."],
["medium","What is a pessary?",["A solid medicine placed in the vagina","A tablet swallowed","An ear drop","A cough syrup"],"Follow instructions."],
["medium","What is an inhaler used for?",["Delivering medicine to the lungs","Treating skin","Treating the ear","Cleaning teeth"],"Use correct technique."],
["medium","What is a dispersible tablet?",["A tablet that dissolves in water before taking","A tablet swallowed whole only","A cream","A suppository"],"Helps children and those who cannot swallow."],
["medium","What is a powder for reconstitution?",["A powder mixed with clean water before use","A tablet","A cream","A patch"],"Follow mixing instructions."],
]);
T("Routes of administration",[
["medium","What does 'oral' route mean?",["By mouth","By injection","On the skin","Into the eye"],"Most common route."],
["medium","What does 'topical' mean?",["Applied to the skin or surface","Swallowed","Injected","Inhaled"],"Local effect."],
["medium","What does 'intravenous' mean?",["Into a vein","Into a muscle","Under the skin","By mouth"],"Gives fast effect."],
["medium","What does 'intramuscular' mean?",["Into a muscle","Into a vein","By mouth","On the skin"],"Used for some injections."],
["medium","What does 'subcutaneous' mean?",["Under the skin","Into a vein","By mouth","On the skin"],"Used for insulin."],
["medium","What does 'rectal' route mean?",["Into the rectum","By mouth","Under the tongue","Into the ear"],"Suppositories."],
["medium","What does 'ophthalmic' refer to?",["The eye","The ear","The nose","The skin"],"Eye medicines."],
["medium","What does 'otic' refer to?",["The ear","The eye","The nose","The throat"],"Ear drops."],
["medium","What does 'nasal' refer to?",["The nose","The ear","The eye","The mouth"],"Nasal sprays."],
["medium","What does 'inhalation' mean?",["Breathing a medicine into the lungs","Swallowing","Injecting","Applying"],"Inhalers and nebulisers."],
]);
T("Medicine abbreviations",[
["medium","What does 'OD' commonly mean on a prescription?",["Once daily","Twice daily","Every hour","As needed"],"Check clearly."],
["medium","What does 'BD' or 'bid' commonly mean?",["Twice daily","Once daily","Four times daily","Every night"],"Spaced about 12 hours apart."],
["medium","What does 'TDS' or 'tid' commonly mean?",["Three times daily","Twice daily","Once daily","Hourly"],"Space through the day."],
["medium","What does 'PRN' mean?",["When required","Every day","Every night","Never"],"Use only if needed."],
["medium","What does 'stat' mean?",["Immediately","Daily","Weekly","Monthly"],"Give at once."],
["medium","What does 'nocte' mean?",["At night","In the morning","Twice daily","At noon"],"Take at bedtime."],
["medium","What does 'a.c.' mean?",["Before meals","After meals","With meals","At night"],"Check with the pharmacist."],
["medium","What does 'p.c.' mean?",["After meals","Before meals","At night","Daily"],"Take after food."],
["medium","What does 'NPO' mean?",["Nothing by mouth","Needs pharmacist opinion","Normal pain order","New prescription only"],"Used in hospitals."],
["medium","What does 'IM' mean?",["Intramuscular","Internal medicine","Immediately","Inhaled medicine"],"An injection route."],
["medium","What does 'IV' mean?",["Intravenous","Internal vitamin","Inhaled vapour","Immediate vaccine"],"Into a vein."],
["medium","What does 'SC' or 'SQ' mean?",["Subcutaneous","Special care","Single capsule","Second course"],"Under the skin."],
]);
T("Antibiotic safety",[
["medium","Why must antibiotics be taken at regular times?",["To keep the level steady in the body","To save pills","To taste better","It is a custom"],"Follow the schedule."],
["medium","What should you do if you get a rash after starting an antibiotic?",["Stop and seek advice quickly","Ignore it","Take more","Mix with another"],"It may be an allergy."],
["medium","Why should antibiotics not be shared between family members?",["Different illnesses and doses need different treatment","They are free","They are sweet","It is a rule only"],"Use only what is prescribed."],
["medium","Which antibiotics are linked to stomach upset and diarrhoea?",["Many antibiotics can cause it","None","Only injections","Only creams"],"Report severe diarrhoea."],
["medium","Why should a full antibiotic course usually be finished as directed?",["To clear the infection and reduce resistance","To use up tablets","It tastes good","It is a rule only"],"Do not stop early unless advised."],
["medium","Can antibiotics treat viral infections?",["No","Yes","Only some","Only in children"],"They only treat bacteria."],
["medium","Why should alcohol be avoided with some antibiotics?",["It can cause bad reactions","It helps absorption","It is cheaper","It colours urine"],"Check the leaflet."],
["medium","What is a sign of a severe reaction to an antibiotic?",["Swelling of face and difficulty breathing","Mild nausea","A dry mouth","Sleepiness"],"Emergency."],
]);
T("Pain and fever in children",[
["medium","What is a common sign of fever in children?",["Hot skin, flushed face and irritability","Cold feet only","Hunger","Sneezing"],"Measure with a thermometer."],
["medium","What helps a child with a fever?",["Fluids, light clothing and rest","Heavy blankets","Alcohol rubs","Cold baths"],"See a health worker if high or lasting."],
["medium","When should a baby under three months with fever see a health worker?",["Immediately","After a week","Never","After two weeks"],"Young babies are at higher risk."],
["medium","Why should dosing be done by weight for children where advised?",["It is safer and more accurate","It is faster","It is cheaper","It is a custom"],"Use the correct measure."],
["medium","What should you use to measure liquid medicine for a child?",["The supplied measuring device","A kitchen spoon","Any cup","A bottle cap"],"Spoons vary in size."],
["medium","Why should adult medicines not be halved for small children?",["Doses and formulations differ","It is cheaper","It is faster","It is a rule only"],"Use child formulations."],
["medium","What is a febrile convulsion?",["A fit caused by fever in young children","A cough","A rash","A sprain"],"Seek urgent care."],
]);
T("Common eye and skin products",[
["medium","Why should expired eye drops not be used?",["They can cause infection","They taste bad","They are cold","They are sweet"],"Discard at the stated time."],
["medium","Why should contact lenses not be worn when the eyes are red and sore?",["It can worsen infection","They are too tight","They are too dry","It is a rule only"],"Remove and seek advice."],
["medium","What is a safe way to apply a skin cream?",["Wash hands, apply a thin layer and wash hands again","Apply thickly","Apply to broken skin always","Share the tube"],"Follow the label."],
["medium","Why should steroid creams not be used on the face without advice?",["They can thin the skin","They are expensive","They smell","They are cold"],"Use as directed."],
["medium","Why should sunscreen be reapplied?",["It wears off with sweat and time","It expires","It dries","It is a rule only"],"Reapply every two hours outdoors."],
["medium","What is a sign of a skin infection that needs review?",["Spreading redness, warmth and pus","Dry skin","Mild itch","Slight freckles"],"See a health worker."],
["medium","Why should skin creams not be shared?",["Infections can spread","They are cheap","They are thick","They are sweet"],"Use personal tubes."],
["medium","What is a sensible use of an antiseptic?",["Cleaning minor cuts","Drinking","Swallowing","Injecting"],"For external use."],
]);
T("Wellness and prevention",[
["medium","Why is annual blood pressure checking recommended for adults?",["To find silent high blood pressure","To use time","It is a rule only","It is costly"],"Check regularly."],
["medium","Why is regular blood sugar checking advised for those at risk?",["To find diabetes early","To use strips","It is a rule only","It is costly"],"Risk groups include older adults."],
["medium","What is the best way to prevent most infections?",["Hygiene, vaccination and safe water","Antibiotics for all","Isolation always","Herbs only"],"Prevention is better than cure."],
["medium","How can stress be reduced?",["Exercise, sleep and talking to someone","Alcohol","Skipping meals","Isolating"],"Seek help if it persists."],
["medium","Why should tobacco be avoided?",["It harms the heart, lungs and increases cancer risk","It helps relaxation","It cures cough","It lowers weight safely"],"Quitting helps."],
["medium","Why should sugary drinks be limited?",["They add calories and raise diabetes risk","They are medicines","They improve bones","They cure thirst best"],"Choose water."],
["medium","Why should adults avoid heavy alcohol use?",["It harms the liver, heart and mind","It cures stress","It builds muscles","It is healthy"],"Drink in moderation or not at all."],
["medium","Why are regular dental checkups useful?",["They find problems early","They are costly","They are a rule only","They are not needed"],"Visit yearly."],
]);
T("Newborn and baby care",[
["medium","Why is skin-to-skin contact helpful after birth?",["It keeps the baby warm and helps breastfeeding","It tires the baby","It is a custom","It causes infection"],"Encourage it."],
["medium","How should the umbilical cord stump be cared for?",["Keep it clean and dry","Apply herbs","Cover with powder","Pull it off"],"Seek advice if red or smelly."],
["medium","Why should babies sleep on their backs?",["It lowers the risk of sudden infant death","It is comfortable for parents","It prevents crying","It is a custom"],"Use a firm mattress."],
["medium","What is a sign a newborn needs urgent care?",["Not feeding, fast breathing or fever","Sleeping a lot","Yawning","Hiccups"],"Take them to a facility."],
["medium","How often do newborns usually feed?",["About 8 to 12 times a day","Once a day","Twice a day","Once a week"],"Feed on demand."],
["medium","Why should newborns not be given water or herbal drinks?",["Breast milk is enough and other fluids can harm","Water is dirty","It is a rule","It is cheap"],"Exclusive breastfeeding for six months."],
["medium","Why should babies be kept warm?",["They lose heat quickly","They are noisy","They are bored","It is a custom"],"Cover the head and body."],
["medium","What is jaundice in newborns?",["Yellow skin and eyes","A cough","A rash","A fever"],"See a health worker."],
]);
T("Pharmacy workplace safety",[
["medium","Why should pharmacy floors be kept dry and clear?",["To prevent slips and falls","To use mops","It is a rule only","It is a custom"],"Report spills."],
["medium","Why should heavy boxes be stored low?",["To prevent injury from lifting and falling","To save space","To look neat","It is a custom"],"Lift with the legs."],
["medium","What should be done about frayed electrical cables?",["Report and replace them","Ignore them","Tape and use","Hide them"],"Prevent fire and shock."],
["medium","Why should fire exits be kept clear?",["For safe escape in an emergency","To save space","To look neat","It is a custom"],"Practise drills."],
["medium","Why should staff know where the fire extinguisher is?",["To use it quickly in a fire","To hide it","To count it","It is decoration"],"Check it regularly."],
["medium","Why should chemicals in the pharmacy be stored properly?",["To prevent spills, harm and mix-ups","To look neat","To save money","It is a custom"],"Label and separate."],
["medium","What should you do if a staff member is injured at work?",["Give first aid and record the incident","Ignore it","Hide it","Charge them"],"Report it."],
["medium","Why should staff wash hands before preparing medicines?",["To avoid contaminating them","To warm hands","To save soap","It is a custom"],"Hygiene matters."],
]);
T("Understanding test results",[
["medium","What is a normal resting adult pulse rate?",["About 60 to 100 beats per minute","10 to 20","200 to 300","0"],"Varies with fitness."],
["medium","What is a normal adult temperature?",["About 36.5 to 37.5 degrees Celsius","30 degrees","42 degrees","20 degrees"],"A reading above 38 is a fever."],
["medium","What does a fasting blood sugar above the normal range suggest?",["Possible diabetes needing confirmation","Normal health","Anaemia","Malaria"],"Refer for confirmation."],
["medium","What is a normal adult breathing rate at rest?",["About 12 to 20 breaths per minute","1 to 2","40 to 50","0"],"Count for a full minute."],
["medium","What does a low haemoglobin suggest?",["Anaemia","Diabetes","Hypertension","Asthma"],"Seek a cause."],
["medium","Why should a single high blood pressure reading not be used to diagnose hypertension?",["Readings vary and need repeating","It is always right","It is a rule only","It is costly"],"Measure on separate occasions."],
["medium","What is a rapid malaria test used for?",["Detecting malaria parasites from a blood sample","Measuring blood sugar","Checking hearing","Counting teeth"],"Follow the result with treatment."],
["medium","What is a urine dipstick used to check?",["Signs such as glucose, protein or infection","Bone density","Eyesight","Heart rate"],"A screening tool."],
]);
T("Pharmacy maths",[
["medium","How many milligrams are in 1 gram?",["1000","10","100","10000"],"1 g = 1000 mg."],
["medium","How many micrograms are in 1 milligram?",["1000","10","100","10000"],"1 mg = 1000 mcg."],
["medium","If a tablet is 250 mg, how many tablets give 1000 mg?",["4","2","8","10"],"1000 divided by 250 = 4."],
["medium","If a dose is 5 ml three times daily, how many ml per day?",["15 ml","5 ml","10 ml","20 ml"],"5 × 3 = 15."],
["medium","If a course is 2 tablets twice daily for 5 days, how many tablets are needed?",["20","10","15","25"],"2 × 2 × 5 = 20."],
["medium","How many ml in half a litre?",["500","50","250","1000"],"1 L = 1000 ml."],
["medium","What is 10% of 200?",["20","10","2","100"],"10% = one tenth."],
["medium","What is 25% of 80?",["20","25","40","10"],"Quarter of 80."],
["medium","If 1 tablet costs GHS 2.50, what do 4 cost?",["GHS 10.00","GHS 8.00","GHS 12.00","GHS 9.00"],"2.50 × 4 = 10."],
["medium","How many 5 ml doses are in a 100 ml bottle?",["20","10","5","50"],"100 divided by 5 = 20."],
["medium","If a 500 mg tablet is taken twice daily, what is the daily total?",["1000 mg","500 mg","250 mg","2000 mg"],"500 × 2 = 1000."],
["medium","How many days does a 30-tablet pack last at 3 tablets a day?",["10","30","15","3"],"30 divided by 3 = 10."],
]);
T("Health insurance and costs",[
["medium","How does NHIS help patients?",["It covers part of the cost of many health services","It gives free food","It replaces clinics","It sells medicines"],"Renew membership on time."],
["medium","Why is it useful to renew NHIS membership before it expires?",["To keep cover and avoid paying more","To use a card","It is a rule only","It is costly"],"Check the expiry date."],
["medium","Why should patients ask about the cost of a medicine before buying?",["To make informed choices","To argue","To waste time","It is rude"],"Ask about generic options."],
["medium","What is a generic medicine?",["A medicine with the same active ingredient as a brand","A fake","A herbal","A vitamin"],"Often cheaper."],
["medium","Why should patients keep receipts for medicines?",["For records and returns","To fill pockets","It is a rule only","It is not useful"],"Useful for claims."],
["medium","What does a co-payment mean?",["The patient pays part of the cost","The patient pays nothing","A discount","A refund"],"Depends on the scheme."],
]);
T("Environment and health",[
["medium","How can air pollution affect health?",["It can worsen breathing and heart problems","It improves lungs","It has no effect","It builds bones"],"Reduce smoke and fumes."],
["medium","Why is clean cooking fuel better for health?",["It reduces indoor smoke","It is cheaper always","It is louder","It is slower"],"Protect lungs."],
["medium","Why should stagnant water be removed?",["To reduce mosquito breeding","To save water","To look neat","It is a custom"],"Cover storage containers."],
["medium","What is a heat-related illness sign?",["Dizziness, headache and very hot skin","Cold hands","Itchy eyes","Mild cough"],"Cool the person and seek help."],
["medium","How can people stay safe in hot weather?",["Drink water and rest in shade","Exercise at noon","Wear dark thick clothes","Avoid fluids"],"Avoid peak heat."],
["medium","Why should flood water be avoided?",["It can carry germs and hazards","It is clean","It is cold","It is cheap"],"Do not drink it."],
]);
T("Counterfeit and quality",[
["medium","What is a counterfeit medicine?",["A fake medicine deliberately mislabelled","A generic","A herbal","A vitamin"],"Buy from licensed sources."],
["medium","What is a sign a medicine pack may be fake?",["Poor printing, spelling errors or damaged seals","Clear print","Intact seal","Correct batch details"],"Report it."],
["medium","Why are fake medicines dangerous?",["They may have wrong or no active ingredient","They are cheap","They are sweet","They are colourful"],"Report suspicions."],
["medium","What should you do if you suspect a fake product?",["Do not sell it and report to the regulator","Sell it quickly","Hide it","Return it to the customer"],"Protect patients."],
["medium","Why buy from licensed wholesalers?",["Products are traceable and genuine","It is cheaper","It is faster","It is a custom"],"Keep invoices."],
["medium","What does a tamper-evident seal show?",["Whether a pack has been opened","The price","The colour","The brand"],"Do not sell if broken."],
["medium","Why should medicine not be bought from street vendors?",["Storage and source are unknown","It is cheaper","It is faster","It is popular"],"Risk of poor quality."],
["medium","What does a recall mean?",["Removing a product from sale due to a problem","A sale","A discount","A new product"],"Follow the notice."],
]);
T("Community health practices",[
["medium","Why is community engagement important in health programmes?",["People support what they help plan","It wastes time","It is a rule only","It is costly"],"Include local leaders."],
["medium","What is a mass vaccination campaign?",["Vaccinating many people in a short time","One shot","A diet","A medicine sale"],"Prevents outbreaks."],
["medium","Why do community health workers visit households?",["To educate and refer people for care","To sell goods","To collect taxes","To count houses"],"Link families to clinics."],
["medium","Why is a clean, safe water source important in a community?",["It prevents many diseases","It looks neat","It is cheap","It is not needed"],"Protect and maintain it."],
["medium","What is a health screening camp?",["An event offering tests to a community","A school","A farm","A market"],"Encourage follow-up."],
["medium","Why are traditional leaders helpful in health campaigns?",["They influence trust and participation","They sell medicines","They run clinics","They fix roads"],"Work with them."],
]);
T("Safe self-care",[
["medium","When is self-care with an over-the-counter medicine appropriate?",["For minor, short-lived problems with clear instructions","For serious illness","For chest pain","For any illness"],"Seek advice if unsure."],
["medium","When should a person stop self-treatment and see a health worker?",["If symptoms are severe, persist or worsen","If they feel better","If it is raining","If bored"],"Do not delay."],
["medium","Why check the active ingredient before taking a new product?",["To avoid doubling up","To check colour","To check price","To check size"],"Read the label."],
["medium","What should a person do before taking a medicine in pregnancy?",["Ask a health worker or pharmacist","Take it anyway","Share it","Double it"],"Some medicines are unsafe."],
["medium","Why should a person avoid taking leftover prescription medicine for a new illness?",["It may be wrong or unsafe","It is old","It is cold","It is cheap"],"Seek assessment."],
["medium","What is a good habit before any new medicine?",["Tell the pharmacist about other medicines and allergies","Hide them","Skip reading the label","Take double"],"Share your list."],
]);
T("Wounds, burns and bites",[
["medium","What is the first step for a snake bite?",["Keep the person calm and still and get to a hospital","Cut the wound","Suck the venom","Tie a tight tourniquet"],"Do not delay."],
["medium","What should be avoided after a dog bite?",["Ignoring it","Washing it with soap and water","Seeking care","Getting rabies advice"],"Seek care for rabies and tetanus."],
["medium","What should you do for a chemical burn on the skin?",["Rinse with plenty of clean water","Rub it","Apply oil","Ignore it"],"Remove contaminated clothing."],
["medium","What should you do for a minor scald?",["Cool under running water","Apply butter","Apply ice for an hour","Burst blisters"],"Seek care for large burns."],
["medium","Why should a deep wound from a rusty nail be checked?",["Risk of tetanus","It is rusty","It is old","It is cold"],"Check vaccination."],
["medium","How should a bee sting be handled?",["Remove the sting and cool the area","Squeeze it","Apply oil","Ignore it"],"Watch for allergy signs."],
]);
T("Mental wellbeing basics",[
["medium","Why is talking about feelings helpful?",["It reduces isolation and stress","It is rude","It is a weakness","It spreads illness"],"Find someone you trust."],
["medium","What is a sign that someone may need mental health support?",["Long-lasting low mood or withdrawal","A good mood","Playing sports","Singing"],"Refer for help."],
["medium","How can you support a friend with low mood?",["Listen without judging and encourage help-seeking","Ignore them","Laugh at them","Gossip"],"Be kind."],
["medium","Why is regular exercise good for mood?",["It reduces stress and improves wellbeing","It tires the brain","It causes illness","It replaces sleep"],"Move daily."],
["medium","Why is stigma about mental illness harmful?",["It stops people from seeking help","It helps people","It is polite","It is normal"],"Be supportive."],
["medium","What is a healthy way to handle worry?",["Share with someone and make a plan","Hide it","Drink alcohol","Isolate"],"Seek help if overwhelming."],
]);
T("Healthy pregnancy habits",[
["medium","Why attend antenatal care early?",["To protect mother and baby","To waste time","It is a rule only","It is costly"],"Attend all visits."],
["medium","Why should pregnant women sleep under a treated net?",["To prevent malaria","To stay warm","To look neat","It is a custom"],"Malaria is dangerous in pregnancy."],
["medium","Why should pregnant women avoid alcohol and tobacco?",["They can harm the baby","They help the baby","They are medicines","It is a custom"],"Seek support to stop."],
["medium","Why should pregnant women take only medicines advised by a health worker?",["Some medicines can harm the baby","They are expensive","They are sweet","It is a custom"],"Always ask."],
["medium","What is a danger sign in pregnancy?",["Heavy bleeding or severe headache","Mild tiredness","Craving food","Sleepiness"],"Go to a facility at once."],
["medium","Why is a balanced diet important in pregnancy?",["It supports the baby's growth","It is a custom","It is costly","It is not needed"],"Eat a variety of foods."],
]);
T("Tropical diseases and prevention",[
["medium","What is dengue?",["A mosquito-borne viral illness","A stomach infection","A bone disease","A skin cancer"],"Avoid mosquito bites."],
["medium","What is yellow fever prevented by?",["Vaccination","Antibiotics","Herbs","Bed rest"],"A single dose usually gives lifelong protection."],
["medium","What is rabies?",["A viral disease spread by animal bites","A bacterial disease","A fungal disease","A vitamin lack"],"Seek urgent care after bites."],
["medium","What is Lassa fever spread by?",["Contact with rodents or their droppings","Mosquito bites","Dog licks","Raw fruit"],"Keep food covered and rodent-free."],
["medium","What is Ebola spread by?",["Contact with body fluids of infected people or animals","Mosquito bites","Water only","Wind"],"Use protective measures."],
["medium","What is anthrax?",["A bacterial disease from animals or their products","A viral cough","A vitamin lack","A skin rash"],"Avoid contact with sick animals."],
["medium","What is cholera prevented by?",["Safe water, hygiene and vaccination","Antibiotics for all","Fasting","Herbs only"],"Wash hands."],
["medium","Why are rodents a health risk?",["They can spread disease","They are noisy","They are cute","They are cold"],"Store food safely."],
]);
T("Safe use of herbal products",[
["medium","Why should herbal product labels be checked for registration?",["To confirm they are approved for sale","To read colours","To check weight","It is a custom"],"Check the regulator's mark."],
["medium","Why should herbal products not be mixed with prescription medicines without advice?",["They can interact","They are cheap","They are sweet","It is a custom"],"Ask a pharmacist."],
["medium","Can herbal medicines be harmful?",["Yes, some can","Never","Only in children","Only in water"],"Natural does not mean safe."],
["medium","What should be avoided in herbal advertising?",["Claims to cure many serious diseases","Honest ingredients","Clear labels","Safety warnings"],"Be wary of miracle claims."],
["medium","What should a patient tell their doctor about herbal products?",["That they are using them","Nothing","Only the price","Only the name"],"Disclose all products."],
["medium","Why avoid herbal products with no ingredients listed?",["The contents and safety are unknown","They are too cheap","They are too strong","It is a custom"],"Choose registered products."],
]);
T("Immunity and recovery",[
["medium","What helps the body recover from illness?",["Rest, fluids and good nutrition","Skipping meals","Heavy exercise","Alcohol"],"Follow health advice."],
["medium","Why is sleep important for immunity?",["The body repairs and fights infection during sleep","Sleep tires the body","It has no effect","It adds weight"],"Get enough rest."],
["medium","Why are vaccines safer than getting the disease?",["They give protection without the full illness","They cause the disease","They are free","They are sweet"],"Complete the schedule."],
["medium","What is a sensible response to a mild illness like a cold?",["Rest and drink fluids","Take antibiotics","Fast","Exercise hard"],"Seek help if severe."],
["medium","What can weaken immunity?",["Poor nutrition, stress and lack of sleep","Fruit","Water","Rest"],"Live healthily."],
["medium","What should convalescing people do?",["Rest and return to activity gradually","Overwork","Skip meals","Stay in bed for months"],"Listen to the body."],
]);
T("Medicines for older adults",[
["medium","Why can older adults be more sensitive to medicines?",["Their bodies process medicines more slowly","They are weaker","They are lucky","It is a custom"],"Doses may need adjusting."],
["medium","Why should older adults have their medicines reviewed regularly?",["To remove ones no longer needed","To spend money","It is a rule only","It is costly"],"Avoid unnecessary medicines."],
["medium","What is a risk of taking many medicines together?",["More side effects and interactions","Better health always","Lower cost","None"],"Ask a pharmacist."],
["medium","Why should large tablets be asked about if swallowing is difficult?",["Other forms may be available","They are expensive","They are sweet","It is a custom"],"Do not crush without advice."],
["medium","Why is good lighting helpful when reading labels?",["It prevents errors","It saves money","It looks nice","It is a custom"],"Use large print where available."],
["medium","What is a good routine for older adults on many medicines?",["A pill organiser and a written schedule","Guessing","Skipping doses","Sharing"],"Ask a pharmacist for help."],
]);
module.exports=R.map(r=>[r[0],r[1],r[2],r[3],0,r[4]]);
