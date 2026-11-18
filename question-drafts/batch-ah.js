// DRAFT questions - NOT reviewed. Import as "pending"; a pharmacist must approve each one.
const R=[];const T=(t,rows)=>rows.forEach(r=>R.push([t,r[0],r[1],r[2],r[3]]));
T("Common infections",[
["medium","How is typhoid usually spread?",["Through food or water contaminated with faeces","By mosquito bites","By handshakes","By sunlight"],"Clean water and handwashing prevent it."],
["medium","What is a typical sign of typhoid?",["Prolonged fever with abdominal pain and weakness","A runny nose","Itchy eyes","Sore feet"],"Needs testing and proper treatment."],
["medium","What is the key first step for severe watery diarrhoea like cholera?",["Rehydrate quickly with ORS and seek urgent care","Stop all fluids","Give strong laxatives","Wait three days"],"Fluid loss can be fatal."],
["medium","What is the main sign of cholera?",["Profuse watery 'rice-water' diarrhoea","Constipation","Itchy skin","Cough"],"Report suspected outbreaks."],
["medium","Which disease is spread by a bite from a tsetse fly?",["Sleeping sickness","Typhoid","Cholera","Rabies"],"Seen in some African regions."],
["medium","What does a urinary tract infection often cause?",["Burning when passing urine and frequent urination","Itchy ears","A rash","Loss of smell"],"Refer for testing and treatment."],
["medium","Why should UTI symptoms with fever and back pain be referred?",["The infection may have reached the kidneys","They always go away","They are harmless","They mean pregnancy"],"Kidney infection is serious."],
["medium","What is the common cause of boils?",["A bacterial skin infection","A cold","A virus only","An allergy to water"],"Do not squeeze; seek care if large."],
["medium","What does hepatitis B spread through?",["Blood, body fluids and from mother to baby","Casual contact like hugging","Mosquitoes","Water only"],"A vaccine is available."],
["medium","Which vaccine helps protect newborns from hepatitis B?",["Hepatitis B vaccine","BCG alone","Measles vaccine","Yellow fever vaccine"],"Birth dose is recommended in many programmes."],
["medium","What is the best advice for chickenpox in a child?",["Keep clean, trim nails, rest and avoid scratching; see a health worker if unwell","Scratch freely","Apply soil","Break the blisters"],"Avoid contact with pregnant women."],
["medium","What is a sign of measles?",["Fever with a rash and red eyes","Joint swelling","Black stools","Hearing loss"],"Vaccination prevents measles."],
["medium","What does Lassa fever commonly spread through?",["Contact with rodent urine or droppings and body fluids","Mosquito bites","Eating fruit","Shaking hands only"],"Report suspected cases promptly."],
["medium","What is the key message to prevent Ebola spread?",["Avoid contact with body fluids and report suspected cases","Hug sick people","Eat bush meat raw","Touch the dead"],"Outbreak control needs reporting."],
["medium","What is conjunctivitis?",["Inflammation or infection of the eye's outer layer","A skin cancer","A stomach problem","A heart disease"],"Good hygiene reduces spread."],
["medium","Why do athlete's foot infections recur?",["Moist feet and shared damp surfaces","Eating spices","Cold weather only","Dry air only"],"Keep feet dry."],
]);
T("Anaemia and blood",[
["medium","What is anaemia?",["Low red blood cells or haemoglobin","High blood sugar","Low blood pressure only","A bone fracture"],"It reduces oxygen delivery."],
["medium","Which symptom suggests anaemia?",["Tiredness, pallor and breathlessness","Itchy ears","Sore throat only","Sneezing"],"Refer for testing."],
["medium","What is a common cause of anaemia in pregnancy?",["Iron deficiency","Too much sleep","Too much water","Sunburn"],"Antenatal iron is common."],
["medium","How can iron absorption be improved?",["Take with vitamin C-rich food and away from tea or milk","Take with tea","Take with antacids","Take with coffee"],"Timing matters."],
["medium","Why can iron tablets turn stools dark?",["They are a harmless side effect","It means bleeding always","It means infection","It means allergy"],"But black tarry stools with weakness need review."],
["medium","What is sickle cell disease?",["An inherited blood condition causing abnormal red cells","An infection","An allergy","A vitamin overdose"],"Needs ongoing care."],
["medium","What is a trigger for sickle cell crisis?",["Dehydration, infection and cold","Eating fruit","Light exercise only","Sunshine only"],"Encourage fluids."],
["medium","Why is folic acid advised before and in early pregnancy?",["It helps prevent neural tube defects","It prevents malaria","It lowers sugar","It cures fever"],"Take as advised."],
["medium","Which foods help prevent anaemia?",["Meat, fish, beans and leafy greens","Sugar only","Sweets","Soft drinks"],"Eat a varied diet."],
["medium","What should you advise a person with heavy periods and tiredness?",["See a health worker to check for anaemia","Take more painkillers","Ignore it","Stop eating"],"Heavy bleeding can cause anaemia."],
]);
T("Women's and men's health",[
["medium","What is a sign of a vaginal yeast infection?",["Itching and thick white discharge","High fever","Sore throat","Cough"],"Refer if recurrent or unsure."],
["medium","What should you advise a woman with foul-smelling discharge and lower abdominal pain?",["See a health worker for testing","Use perfumed washes","Use strong antibiotics","Ignore it"],"May be an infection needing treatment."],
["medium","Why should women avoid douching?",["It can disturb normal vaginal balance","It cures infection","It prevents pregnancy","It is required"],"Gentle external washing is enough."],
["medium","What is a typical sign of menopause?",["Hot flushes and irregular periods","Sneezing","Itchy feet","Hearing loss"],"Support and advice help."],
["medium","What is a fibroid?",["A non-cancerous growth in the womb","A lung infection","A bone fracture","A skin rash"],"May cause heavy periods."],
["medium","Why should men over 50 discuss prostate symptoms with a health worker?",["Urinary problems can signal prostate disease","Prostate never changes","It is always cancer","It is unrelated"],"Early assessment helps."],
["medium","What advice supports male fertility generally?",["Healthy lifestyle, avoid smoking and heavy alcohol","Heat baths daily","Tight hot clothing","Using steroids"],"Healthy habits help."],
["medium","What should a couple do if they have not conceived after a year of trying?",["See a health worker together","Take random pills","Wait ten years","Blame one partner"],"Both partners may need checks."],
["medium","What does 'antenatal care' mean?",["Health care during pregnancy","Care after birth","Care in old age","Care for teeth"],"Attend regularly."],
["medium","What is a danger sign in pregnancy?",["Severe headache, blurred vision or swelling of face and hands","Mild tiredness","Sleepiness","Mild backache"],"Possible pre-eclampsia."],
["medium","What is a sign of labour that needs a clinic visit?",["Regular painful contractions or the waters breaking","A single sneeze","Craving fruit","A mild headache"],"Go to a health facility."],
["medium","Why is exclusive breastfeeding encouraged in the first six months?",["It gives complete nutrition and protects against infections","It prevents all illness","It replaces vaccines","It is free only"],"WHO recommends it."],
]);
module.exports=R.map(r=>[r[0],r[1],r[2],r[3],0,r[4]]);
