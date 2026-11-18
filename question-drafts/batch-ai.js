// DRAFT questions - NOT reviewed. Import as "pending"; a pharmacist must approve each one.
const R=[];const T=(t,rows)=>rows.forEach(r=>R.push([t,r[0],r[1],r[2],r[3]]));
T("Customer scenarios",[
["medium","A customer asks for antibiotics for a cough that started two days ago. What do you do?",["Ask about symptoms and explain antibiotics may not help; refer if red flags","Sell any antibiotic","Refuse without talking","Sell the strongest one"],"Check symptoms first."],
["medium","A man asks for a sleeping tablet because he cannot sleep for weeks. What is best?",["Ask about causes and refer rather than sell a sedative","Sell several strips","Sell alcohol","Tell him to take double"],"Chronic insomnia needs assessment."],
["medium","A woman asks for a pregnancy test and is anxious. What should you do?",["Be kind and private, explain the test and suggest seeing a health worker","Laugh","Tell neighbours","Refuse"],"Respect privacy."],
["medium","A customer wants to return medicine they bought yesterday. What should you do?",["Follow your policy; medicines usually cannot be resold once sold","Resell it immediately","Throw it","Refund and sell again"],"Returned medicines may be unsafe."],
["medium","A child comes alone with a prescription. What should you do?",["Check details carefully and counsel, and ask a guardian if unsure","Hand it over without checking","Send the child away rudely","Refuse all children"],"Safety and clarity matter."],
["medium","A customer asks you to diagnose a lump on their breast. What is the best response?",["Advise seeing a health worker for examination","Sell massage cream","Say it is nothing","Apply herbs"],"Lumps need assessment."],
["medium","A person asks for a strong painkiller for a toothache every week. What should you do?",["Advise seeing a dentist rather than only selling painkillers","Sell strong painkillers always","Sell antibiotics","Ignore"],"Treat the cause."],
["medium","A customer says their medicine 'does not work any more'. What should you do?",["Ask how they use it and suggest they see their prescriber","Increase the dose","Sell another brand","Tell them to stop"],"Resistance or adherence may be an issue."],
["medium","A person asks if they can take their friend's blood pressure tablets. What is the answer?",["No, medicines are prescribed for individuals","Yes, they are all the same","Yes, if cheaper","Yes, half a tablet"],"Sharing is unsafe."],
["medium","A parent wants antibiotics 'just in case' for their child's fever. What should you say?",["Antibiotics are not for all fevers; see a health worker","Sell the largest bottle","Give the child adult tablets","Wait without advice"],"Fever has many causes."],
["medium","A customer cannot read the label. What should you do?",["Explain it clearly aloud and mark times or use pictures","Give them the leaflet only","Ignore them","Let them guess"],"Ensure understanding."],
["medium","A customer tells you they are drowsy after taking a new cold tablet and must drive. What do you advise?",["Do not drive if drowsy; ask a pharmacist about alternatives","Drive carefully","Take more","Drink coffee only"],"Safety first."],
["medium","A man wants to buy erectile dysfunction pills and also uses chest pain medicine. What should you do?",["Refer to a health worker because the combination can be dangerous","Sell the pills","Sell double","Tell him to ignore chest pain"],"Interactions can be serious."],
["medium","A customer in a hurry asks you not to explain how to take the medicine. What do you do?",["Give the key points quickly and note the label","Say nothing","Delay them","Hide the label"],"Always give essential advice."],
["medium","A person gives a false name for a controlled medicine. What is your best action?",["Do not supply and follow regulations on controlled items","Supply anyway","Supply double","Ignore regulations"],"Follow legal rules."],
["medium","A customer says they feel faint after a long fast and has diabetes. What first?",["Check for low blood sugar and give sugar if conscious","Give insulin","Give tea only","Tell them to sleep"],"Treat suspected hypoglycaemia."],
]);
T("Ethics and law",[
["medium","What does 'confidentiality' require of you?",["Keep customers' health information private","Share on social media","Tell your friends","Post it on the door"],"A core ethical duty."],
["medium","What should you do if you make a dispensing error?",["Tell the customer, correct it and report as required","Hide it","Blame the customer","Change records quietly"],"Honesty protects patients."],
["medium","Why must you work within your scope of practice?",["To protect patients from unqualified care","To earn more","To impress customers","It is optional"],"Refer beyond your limits."],
["medium","Is it ethical to offer gifts to prescribers to push sales?",["No","Yes","Yes if small","Yes on holidays"],"This is improper influence."],
["medium","What is the main duty to a patient who is unable to pay for urgent medicine?",["Help find a safe route to care, such as referral or a clinic","Ignore them","Insult them","Sell fake medicine"],"Compassion and referral."],
["medium","What should you do if a customer offers a bribe to skip a prescription rule?",["Refuse and follow the rules","Accept","Accept half","Ask for more"],"Integrity matters."],
["medium","Why is it wrong to sell medicines past their expiry date?",["They may be ineffective or harmful","It is nice","It saves tax","It adds flavour"],"Remove expired stock."],
["medium","What does informed consent mean?",["A person agrees after understanding the information","A person is forced","A person signs without reading","A person is not told"],"Respect autonomy."],
["medium","What should you do if you suspect a colleague of stealing medicines?",["Report through the proper channel","Join them","Ignore it forever","Gossip"],"Protect patients and the business."],
["medium","Why must staff be properly qualified or supervised for dispensing?",["Errors can harm patients","It is for fun","To raise prices","It is not needed"],"Training protects people."],
]);
T("Record keeping",[
["medium","Why should sales and stock records be kept?",["To track stock, detect loss and meet regulations","To hide sales","To waste time","They are not useful"],"Records support accountability."],
["medium","What should a delivery note be checked against?",["The order and the goods received","The weather","The shop sign","The neighbour"],"Check quantity, batch and expiry."],
["medium","What is a stock-take?",["A physical count of stock compared with records","A sale","A discount","A staff party"],"Do regularly."],
["medium","What should you do if a stock count does not match records?",["Investigate the difference and correct records properly","Ignore it","Delete records","Blame customers"],"Find the cause."],
["medium","Where should controlled medicines records be kept?",["In a secure, accurate register as required by law","On loose paper","In memory","Nowhere"],"Controlled items need strict records."],
["medium","Why should the batch number be recorded on receipt?",["To trace products in recalls","To make the box heavier","To change the price","It is decoration"],"Supports traceability."],
["medium","How long should records generally be kept?",["As long as the law or regulator requires","One day","Never","Until the pen runs out"],"Check current requirements."],
["medium","Why should records be accurate and legible?",["Others must be able to rely on them","To look fancy","To cost more","They need not be"],"Poor records cause errors."],
]);
module.exports=R.map(r=>[r[0],r[1],r[2],r[3],0,r[4]]);
