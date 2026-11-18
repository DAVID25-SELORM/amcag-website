// DRAFT questions - NOT reviewed. Import as "pending"; a pharmacist must approve each one.
const R=[];const T=(t,rows)=>rows.forEach(r=>R.push([t,r[0],r[1],r[2],r[3]]));
T("Poisoning and emergencies",[
["medium","What is the first thing to do for suspected poisoning?",["Get emergency help and bring the container","Make them vomit","Give salt water","Wait"],"Time matters."],
["medium","Why should you not induce vomiting after swallowing petrol or kerosene?",["It can be breathed into the lungs","It is difficult","It spoils clothes","It is harmless"],"Seek medical advice."],
["medium","What should you do for a person who has stopped breathing?",["Call emergency help and start CPR if trained","Wait","Give water","Shake them"],"Start quickly."],
["medium","What is a danger sign of carbon monoxide poisoning?",["Headache, dizziness and drowsiness near a burning fuel source","Itchy skin","Sneezing","Hunger"],"Move to fresh air and get help."],
["medium","What should you do if someone has an epileptic seizure?",["Protect from injury, time it and do not put anything in the mouth","Hold the tongue","Restrain firmly","Give water during seizure"],"Seek help if prolonged."],
["medium","What is heat stroke?",["A dangerous rise in body temperature with confusion","A mild headache","A cold","A rash"],"Cool and seek emergency care."],
["medium","What is a safe first step for heat exhaustion?",["Move to shade, give fluids and cool the person","Run","Give alcohol","Cover with blankets"],"Cooling helps."],
["medium","What is a sign of severe dehydration in an adult?",["Dizziness, very dark urine and fast heartbeat","Pink cheeks","Clear urine","Sweat only"],"Rehydrate."],
["medium","What should you do for a person who is drowning once rescued and unresponsive?",["Call for help and start rescue breaths and CPR if trained","Wait to see","Pour water out","Rub them with oil"],"Act at once."],
["medium","What should you do if a person has a severe allergic reaction and carries an adrenaline pen?",["Help them use it and call emergency services","Hide it","Tell them to rest","Give water only"],"Anaphylaxis is life-threatening."],
["medium","What is a sign of a heart attack in some women?",["Unusual tiredness, breathlessness, nausea or jaw pain","Only mild sneeze","Hunger","Thirst only"],"Symptoms can differ."],
["medium","What is the immediate action for bleeding that soaks through a cloth?",["Add more cloth on top and keep pressing","Remove the cloth","Wash the wound","Release pressure"],"Keep firm pressure."],
]);
T("Dosage forms",[
["medium","What is an effervescent tablet?",["A tablet that fizzes in water","A tablet to chew","A tablet to swallow whole always","A tablet under the tongue"],"Dissolve fully before drinking."],
["medium","What does a sublingual tablet mean?",["Placed under the tongue","Swallowed whole","Inserted rectally","Applied to skin"],"Absorbed through the mouth lining."],
["medium","What is a suppository?",["A solid dose inserted into the rectum or vagina","A tablet","An eye drop","A cream"],"Follow instructions."],
["medium","Why must modified-release tablets not be crushed?",["It can release the dose too quickly","They taste bad","They are tiny","They become sweet"],"Swallow whole unless advised."],
["medium","What does 'enteric-coated' mean?",["Coated to protect the stomach or the drug from stomach acid","A sweet coating","A coloured coating","A water coating"],"Do not crush."],
["medium","What is an emulsion?",["A mixture of oil and water","A pure tablet","A solid powder","A plaster"],"Shake well before use."],
["medium","Why should suspensions be shaken before use?",["Particles settle and the dose would be uneven","To make bubbles","To warm them","To change colour"],"Shake well."],
["medium","What is a lozenge intended for?",["To dissolve slowly in the mouth","To swallow whole","To inject","To apply to skin"],"Used for sore throats."],
["medium","What is a patch (transdermal) used for?",["To deliver medicine through the skin","To cover wounds only","To clean teeth","To cool the body"],"Follow the instructions."],
["medium","What is a nasal spray used for?",["Delivering medicine inside the nose","Cleaning ears","Treating skin","Injecting"],"Do not share sprays."],
["medium","What does 'shake the bottle' on a label mean?",["Mix the contents before each dose","Throw it","Heat it","Do not open it"],"Ensures even dosing."],
["medium","What is the correct way to use eye drops?",["Wash hands, tilt the head back, drop in the pocket and avoid touching the tip","Touch the eye with the tip","Share the bottle","Use over the sink only"],"Avoid contamination."],
]);
T("Women's health care II",[
["medium","How can a person tell the fertile window roughly?",["Counting cycle days is unreliable alone; ask a health worker for methods","It is always day 1","It is always day 28","It does not exist"],"Use reliable methods."],
["medium","What should a woman do if she misses a period and may be pregnant?",["Do a test and attend antenatal care if positive","Take random pills","Ignore","Use herbs"],"Early care helps."],
["medium","What is morning sickness?",["Nausea in early pregnancy","A cold","An allergy","A food poisoning only"],"Severe vomiting needs medical care."],
["medium","What should you advise for severe vomiting in pregnancy?",["See a health worker as dehydration may occur","Take any tablet","Ignore it","Fast"],"May need treatment."],
["medium","Why should pregnant women avoid alcohol?",["It can harm the baby","It aids growth","It is unrelated","It helps labour"],"No safe amount is known."],
["medium","Which sign after delivery needs urgent care?",["Heavy bleeding, fever or severe pain","Mild tiredness","A sleepy baby","A good appetite"],"Danger signs after birth."],
["medium","What advice helps with sore breasts when breastfeeding?",["Good latch, frequent feeding and see a health worker if fever or lump","Stop all breastfeeding abruptly","Apply herbs only","Ignore"],"Mastitis needs care."],
["medium","What is a normal sign that a newborn is feeding well?",["Wet nappies and steady weight gain","No wet nappies","Constant crying only","Fever"],"Monitor feeding."],
]);
T("Eating and digestion II",[
["medium","What is a sign of lactose intolerance?",["Bloating and diarrhoea after milk products","Itchy eyes","Cough","Fever"],"Avoid triggers."],
["medium","What is coeliac disease triggered by?",["Gluten","Sugar","Salt","Water"],"Needs medical diagnosis."],
["medium","Why should reflux sufferers avoid eating just before bed?",["Lying down can worsen reflux","They will gain weight","They will sleep badly only","It spoils food"],"Leave a gap."],
["medium","What is a probiotic?",["Live microorganisms that may help gut balance","An antibiotic","A painkiller","A vitamin"],"Evidence varies."],
["medium","What is a hernia?",["A bulge where tissue pushes through a weak spot","A lung infection","A skin rash","A bone fracture"],"Refer if painful or stuck."],
["medium","What should you advise for black tarry stools or vomiting blood?",["Seek urgent medical care","Take antacids","Ignore","Sleep it off"],"May signal bleeding."],
["medium","What is haemorrhoids (piles)?",["Swollen veins in or around the anus","A liver problem","A lung disease","A skin infection"],"Fibre and fluids help."],
["medium","When should piles bleeding be checked?",["If bleeding is heavy or persists","Never","Only in children","Only once"],"Rule out other causes."],
]);
module.exports=R.map(r=>[r[0],r[1],r[2],r[3],0,r[4]]);
