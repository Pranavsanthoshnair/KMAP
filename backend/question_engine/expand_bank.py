"""expand_bank.py — Add missing subtopics to question_bank.json for all grades."""
import json
from pathlib import Path

bank_file = Path(__file__).parent / "question_bank.json"
bank = json.loads(bank_file.read_text(encoding="utf-8"))

# ─── MATH ADDITIONS ──────────────────────────────────────────────────────────
math_adds = {
    "grade1": {
        "counting": {"patterns": [
            {"id":"m1_cnt1","type":"count_objects","difficulty":"beginner","template":"Count: How many objects are there if you have {a} groups of {b}?","answer_expr":"a * b","distractor_exprs":["a*b+1","a+b","a*b-1"],"constraints":{"a":[2,4],"b":[2,5]}},
            {"id":"m1_cnt2","type":"number_order","difficulty":"beginner","template":"Which number comes after {a}?","answer_expr":"a + 1","distractor_exprs":["a-1","a+2","a"],"constraints":{"a":[10,50]}},
        ]},
        "shapes": {"patterns": [
            {"id":"m1_sh1","type":"shape_sides","difficulty":"beginner","template":"How many sides does a triangle have?","answer":"3","distractors":["4","5","2"]},
            {"id":"m1_sh2","type":"shape_name","difficulty":"beginner","template":"A shape with 4 equal sides is called a:","answer":"Square","distractors":["Triangle","Circle","Rectangle"]},
        ]},
        "comparison": {"patterns": [
            {"id":"m1_cmp1","type":"greater_than","difficulty":"beginner","template":"Which is greater: {a} or {b}?","answer_expr":"max(a, b)","distractor_exprs":["min(a, b)","a+b","abs(a-b)"],"constraints":{"a":[5,20],"b":[5,20]}},
        ]},
        "patterns_sequences": {"patterns": [
            {"id":"m1_ps1","type":"next_number","difficulty":"beginner","template":"What comes next: {a}, {b}, {c}, ___?","computed":{"b":"a+d","c":"a+2*d"},"answer_expr":"a + 3*d","distractor_exprs":["a+3*d+1","a+3*d-1","a+2*d"],"constraints":{"a":[2,5],"d":[2,3]}},
        ]},
    },
    "grade2": {
        "measurement": {"patterns": [
            {"id":"m2_ms1","type":"length_compare","difficulty":"beginner","template":"Which is longer: {a} cm or {b} cm?","answer_expr":"max(a, b)","distractor_exprs":["min(a, b)","a+b","abs(a-b)"],"constraints":{"a":[5,30],"b":[5,30]}},
            {"id":"m2_ms2","type":"weight_word","difficulty":"intermediate","template":"A bag weighs {a} kg. Another weighs {b} kg. Total weight?","answer_expr":"a + b","distractor_exprs":["a+b+1","a-b","a*b"],"constraints":{"a":[3,10],"b":[2,8]}},
        ]},
        "time": {"patterns": [
            {"id":"m2_tm1","type":"hours","difficulty":"beginner","template":"How many hours are there in a day?","answer":"24","distractors":["12","48","36"]},
            {"id":"m2_tm2","type":"minutes","difficulty":"intermediate","template":"How many minutes are in {a} hours?","answer_expr":"a * 60","distractor_exprs":["a*60+30","a*30","a*60-10"],"constraints":{"a":[2,5]}},
        ]},
        "money": {"patterns": [
            {"id":"m2_mn1","type":"coin_add","difficulty":"beginner","template":"You have {a} rupees and get {b} more. How much do you have?","answer_expr":"a + b","distractor_exprs":["a+b+5","a-b","a*b"],"constraints":{"a":[10,50],"b":[5,25]}},
        ]},
        "division": {"patterns": [
            {"id":"m2_dv1","type":"equal_sharing","difficulty":"intermediate","template":"{c} chocolates shared equally among {b} children. How many each?","computed":{"c":"a*b"},"answer_expr":"a","distractor_exprs":["a+1","a-1","b"],"constraints":{"a":[2,6],"b":[2,5]}},
        ]},
    },
    "grade3": {
        "decimals": {"patterns": [
            {"id":"m3_dc1","type":"decimal_read","difficulty":"beginner","template":"What is {a}.{b} + {c}.0?","answer_expr":"a + c + b/10","distractor_exprs":["a+c","a+c+1","(a+c)*10+b"],"constraints":{"a":[1,5],"b":[1,9],"c":[1,4]}},
        ]},
        "data_handling": {"patterns": [
            {"id":"m3_dh1","type":"bar_read","difficulty":"intermediate","template":"In a class, {a} like cricket and {b} like football. How many more like cricket?","answer_expr":"a - b","distractor_exprs":["a+b","a-b+1","b"],"constraints":{"a":[15,30],"b":[8,14]}},
        ]},
        "patterns_sequences": {"patterns": [
            {"id":"m3_ps1","type":"pattern_rule","difficulty":"intermediate","template":"Find the next: {a}, {b}, {c}, ___","computed":{"b":"a+d","c":"a+2*d"},"answer_expr":"a+3*d","distractor_exprs":["a+3*d+d","a+3*d-1","a+2*d"],"constraints":{"a":[3,10],"d":[3,7]}},
        ]},
        "measurement": {"patterns": [
            {"id":"m3_ms1","type":"cm_to_m","difficulty":"intermediate","template":"Convert {c} cm to metres.","computed":{"c":"a*100"},"answer_expr":"a","distractor_exprs":["a+1","a*10","a*100"],"constraints":{"a":[2,8]}},
        ]},
    },
    "grade4": {
        "fractions": {"patterns": [
            {"id":"m4_fr1","type":"fraction_compare","difficulty":"intermediate","template":"Which is larger: 1/{a} or 1/{b}?","answer_expr":"'1/' + str(min(a,b))","distractor_exprs":["'1/' + str(max(a,b))","'1/' + str(a+b)","'0'"],"constraints":{"a":[2,6],"b":[2,6]}},
        ]},
        "geometry": {"patterns": [
            {"id":"m4_g1","type":"angle_sum","difficulty":"intermediate","template":"Two angles of a triangle are {a}° and {b}°. What is the third angle?","answer_expr":"180 - a - b","distractor_exprs":["180-a","a+b","180-a-b+10"],"constraints":{"a":[30,80],"b":[30,70]}},
            {"id":"m4_g2","type":"circle_part","difficulty":"beginner","template":"What is the name of the distance around a circle?","answer":"Circumference","distractors":["Radius","Diameter","Area"]},
        ]},
        "factors": {"patterns": [
            {"id":"m4_fc1","type":"lcm","difficulty":"advanced","template":"What is the LCM of {a} and {b}?","answer_expr":"(a*b) // gcd(a,b)","distractor_exprs":["a*b","a+b","max(a,b)"],"constraints":{"a":[3,8],"b":[4,9]}},
        ]},
        "number_system": {"patterns": [
            {"id":"m4_ns1","type":"place_value","difficulty":"beginner","template":"What is the place value of 5 in {c}?","computed":{"c":"a*1000 + 500 + b"},"answer":"500","distractors":["50","5","5000"],"constraints":{"a":[2,8],"b":[10,99]}},
        ]},
    },
    "grade5": {
        "fractions": {"patterns": [
            {"id":"m5_fr1","type":"mixed_number","difficulty":"intermediate","template":"Convert {c}/{b} to a mixed number. What is the whole part?","computed":{"c":"a*b+r"},"answer_expr":"a","distractor_exprs":["a+1","a-1","b"],"constraints":{"a":[2,5],"b":[3,7],"r":[1,2]}},
        ]},
        "percentage": {"patterns": [
            {"id":"m5_pc1","type":"pct_of","difficulty":"intermediate","template":"What is {p}% of {c}?","computed":{"c":"k*10"},"answer_expr":"p * k * 10 // 100","distractor_exprs":["p*k*10//100+5","p","k*10"],"constraints":{"p":[10,50],"k":[5,20]}},
            {"id":"m5_pc2","type":"pct_word","difficulty":"advanced","template":"A shirt costs Rs {c}. After {p}% discount, the price is?","computed":{"c":"k*100"},"answer_expr":"k*100 - k*100*p//100","distractor_exprs":["k*100","k*100*p//100","k*100+p"],"constraints":{"k":[2,8],"p":[10,30]}},
        ]},
        "ratio": {"patterns": [
            {"id":"m5_rt1","type":"simplify","difficulty":"intermediate","template":"Simplify the ratio {c}:{d}.","computed":{"c":"a*g","d":"b*g"},"answer_expr":"str(a)+':'+str(b)","distractor_exprs":["str(a+1)+':'+str(b)","str(c)+':'+str(d)","str(b)+':'+str(a)"],"constraints":{"a":[2,5],"b":[3,7],"g":[2,4]}},
        ]},
        "number_system": {"patterns": [
            {"id":"m5_ns1","type":"roman","difficulty":"intermediate","template":"What is the Roman numeral for {a}?","answer":"Cannot compute","distractors":["X","V","L"],"constraints":{"a":[1,20]}},
        ]},
    },
}

# ─── SCIENCE ADDITIONS ───────────────────────────────────────────────────────
sci_adds = {
    "grade1": {
        "animals": {"patterns": [
            {"id":"s1_a1","type":"habitat","difficulty":"beginner","template":"Where does a fish live?","answer":"Water","distractors":["Desert","Forest","Sky"]},
            {"id":"s1_a2","type":"food","difficulty":"beginner","template":"What do herbivores eat?","answer":"Plants","distractors":["Meat","Insects","Stones"]},
        ]},
        "plants": {"patterns": [
            {"id":"s1_pl1","type":"parts","difficulty":"beginner","template":"Which part of the plant absorbs water from the soil?","answer":"Root","distractors":["Leaf","Flower","Stem"]},
        ]},
        "weather": {"patterns": [
            {"id":"s1_w1","type":"season","difficulty":"beginner","template":"In which season do we wear warm clothes?","answer":"Winter","distractors":["Summer","Monsoon","Spring"]},
        ]},
        "senses": {"patterns": [
            {"id":"s1_sn1","type":"organ","difficulty":"beginner","template":"Which sense organ helps us see?","answer":"Eyes","distractors":["Ears","Nose","Tongue"]},
        ]},
    },
    "grade2": {
        "food_nutrition": {"patterns": [
            {"id":"s2_fn1","type":"vitamin","difficulty":"intermediate","template":"Which vitamin do we get from sunlight?","answer":"Vitamin D","distractors":["Vitamin A","Vitamin C","Vitamin B"]},
        ]},
        "water_cycle": {"patterns": [
            {"id":"s2_wc1","type":"process","difficulty":"intermediate","template":"What is the process of water vapour turning into liquid called?","answer":"Condensation","distractors":["Evaporation","Precipitation","Sublimation"]},
        ]},
        "simple_machines": {"patterns": [
            {"id":"s2_sm1","type":"example","difficulty":"beginner","template":"A see-saw is an example of which simple machine?","answer":"Lever","distractors":["Pulley","Wedge","Screw"]},
        ]},
    },
    "grade3": {
        "human_body": {"patterns": [
            {"id":"s3_hb1","type":"skeleton","difficulty":"intermediate","template":"How many bones are in the adult human body?","answer":"206","distractors":["106","306","256"]},
        ]},
        "soil": {"patterns": [
            {"id":"s3_sl1","type":"type","difficulty":"intermediate","template":"Which type of soil holds the most water?","answer":"Clay soil","distractors":["Sandy soil","Loamy soil","Rocky soil"]},
        ]},
        "light": {"patterns": [
            {"id":"s3_lt1","type":"property","difficulty":"intermediate","template":"What happens when light passes through a prism?","answer":"It splits into seven colours","distractors":["It becomes brighter","It turns white","It disappears"]},
        ]},
        "sound": {"patterns": [
            {"id":"s3_snd1","type":"definition","difficulty":"intermediate","template":"Sound travels fastest through which medium?","answer":"Solids","distractors":["Liquids","Gases","Vacuum"]},
        ]},
    },
    "grade4": {
        "magnetism": {"patterns": [
            {"id":"s4_mg1","type":"property","difficulty":"intermediate","template":"Which end of a magnet is attracted to the north pole of another magnet?","answer":"South pole","distractors":["North pole","Both poles","Neither pole"]},
        ]},
        "reproduction": {"patterns": [
            {"id":"s4_rp1","type":"plant","difficulty":"intermediate","template":"Which part of the flower contains the pollen?","answer":"Anther","distractors":["Stigma","Petal","Sepal"]},
        ]},
        "rocks_minerals": {"patterns": [
            {"id":"s4_rm1","type":"classification","difficulty":"intermediate","template":"Which type of rock is formed from cooled lava?","answer":"Igneous rock","distractors":["Sedimentary rock","Metamorphic rock","Limestone"]},
        ]},
    },
    "grade5": {
        "acids_bases": {"patterns": [
            {"id":"s5_ab1","type":"indicator","difficulty":"advanced","template":"Litmus paper turns red in which type of solution?","answer":"Acidic","distractors":["Basic","Neutral","Salty"]},
        ]},
        "periodic_table": {"patterns": [
            {"id":"s5_pt1","type":"element","difficulty":"advanced","template":"What is the chemical symbol for Gold?","answer":"Au","distractors":["Ag","Go","Gd"]},
        ]},
        "forces": {"patterns": [
            {"id":"s5_f1","type":"friction","difficulty":"advanced","template":"Friction is greater on which surface?","answer":"Rough surface","distractors":["Smooth surface","Wet surface","Icy surface"]},
        ]},
    },
}

# ─── ENGLISH ADDITIONS ───────────────────────────────────────────────────────
eng_adds = {
    "grade1": {
        "vocabulary": {"patterns": [
            {"id":"e1_v1","type":"opposite","difficulty":"beginner","template":"What is the opposite of 'big'?","answer":"Small","distractors":["Tall","Fast","Heavy"]},
            {"id":"e1_v2","type":"similar","difficulty":"beginner","template":"Which word means the same as 'happy'?","answer":"Joyful","distractors":["Sad","Angry","Tired"]},
        ]},
        "spelling": {"patterns": [
            {"id":"e1_sp1","type":"correct_spell","difficulty":"beginner","template":"Which is the correct spelling?","answer":"Beautiful","distractors":["Beautful","Beutiful","Beatiful"]},
        ]},
        "reading": {"patterns": [
            {"id":"e1_rd1","type":"comprehension","difficulty":"intermediate","template":"'The cat sat on the mat.' Where is the cat?","answer":"On the mat","distractors":["Under the table","In the garden","On the chair"]},
        ]},
    },
    "grade2": {
        "tenses": {"patterns": [
            {"id":"e2_t1","type":"past","difficulty":"beginner","template":"What is the past tense of 'run'?","answer":"Ran","distractors":["Runned","Running","Runs"]},
            {"id":"e2_t2","type":"present","difficulty":"intermediate","template":"Choose the correct form: 'She ___ to school every day.'","answer":"goes","distractors":["go","going","gone"]},
        ]},
        "sentence_types": {"patterns": [
            {"id":"e2_st1","type":"question","difficulty":"beginner","template":"Which is an interrogative sentence?","answer":"Where are you going?","distractors":["Close the door.","The sun is bright.","What a beautiful day!"]},
        ]},
    },
    "grade3": {
        "poetry": {"patterns": [
            {"id":"e3_po1","type":"rhyme","difficulty":"beginner","template":"Which word rhymes with 'cat'?","answer":"Bat","distractors":["Dog","Cup","Sun"]},
            {"id":"e3_po2","type":"stanza","difficulty":"intermediate","template":"A group of lines in a poem is called a:","answer":"Stanza","distractors":["Paragraph","Chapter","Verse only"]},
        ]},
        "pronouns": {"patterns": [
            {"id":"e3_pr1","type":"replace","difficulty":"intermediate","template":"Replace the noun: 'Riya is playing.' Which pronoun replaces Riya?","answer":"She","distractors":["He","It","They"]},
        ]},
        "conjunctions": {"patterns": [
            {"id":"e3_cj1","type":"joining","difficulty":"beginner","template":"Choose the correct conjunction: 'I want tea ___ coffee.'","answer":"or","distractors":["and","but","so"]},
        ]},
    },
    "grade4": {
        "comprehension": {"patterns": [
            {"id":"e4_c1","type":"inference","difficulty":"intermediate","template":"'Dark clouds gathered. People opened their umbrellas.' What is likely happening?","answer":"It is about to rain","distractors":["It is sunny","It is snowing","It is windy"]},
        ]},
        "idioms": {"patterns": [
            {"id":"e4_id1","type":"meaning","difficulty":"intermediate","template":"What does 'break the ice' mean?","answer":"To start a conversation in a social setting","distractors":["To break something frozen","To cause trouble","To end a friendship"]},
        ]},
        "prepositions": {"patterns": [
            {"id":"e4_pp1","type":"fill","difficulty":"beginner","template":"The book is ___ the table.","answer":"on","distractors":["under","behind","through"]},
        ]},
        "direct_indirect": {"patterns": [
            {"id":"e4_di1","type":"convert","difficulty":"advanced","template":"Change to indirect speech: He said, 'I am happy.'","answer":"He said that he was happy","distractors":["He said I am happy","He says he is happy","He said he is happy"]},
        ]},
    },
    "grade5": {
        "essay_writing": {"patterns": [
            {"id":"e5_ew1","type":"structure","difficulty":"advanced","template":"Which part of an essay introduces the main argument?","answer":"Introduction","distractors":["Body","Conclusion","References"]},
        ]},
        "clause_types": {"patterns": [
            {"id":"e5_ct1","type":"identify","difficulty":"advanced","template":"'Because he was late' is what type of clause?","answer":"Subordinate clause","distractors":["Main clause","Independent clause","Relative clause"]},
        ]},
        "reported_speech": {"patterns": [
            {"id":"e5_rs1","type":"convert","difficulty":"advanced","template":"Convert: 'Will you come?' she asked. → She asked ___","answer":"if I would come","distractors":["will I come","that I will come","I would come"]},
        ]},
    },
}

# ─── MERGE (only subtopics that exist in valid_topics / resources table) ────────
valid_topics_path = Path(__file__).parent / "valid_topics.json"
valid_topics = {}
if valid_topics_path.exists():
    valid_topics = json.loads(valid_topics_path.read_text(encoding="utf-8"))

def is_valid_topic(subject_key: str, grade_key: str, sub_key: str) -> bool:
    if not valid_topics:
        return True
    return sub_key in valid_topics.get(subject_key, {}).get(grade_key, [])

for subject_adds, subject_key in [(math_adds,"math"),(sci_adds,"science"),(eng_adds,"english")]:
    for grade_key, subtopics in subject_adds.items():
        if grade_key not in bank[subject_key]:
            bank[subject_key][grade_key] = {}
        for sub_key, sub_data in subtopics.items():
            if not is_valid_topic(subject_key, grade_key, sub_key):
                continue
            if sub_key not in bank[subject_key][grade_key]:
                bank[subject_key][grade_key][sub_key] = sub_data
            else:
                # Merge patterns avoiding duplicate IDs
                existing_ids = {p["id"] for p in bank[subject_key][grade_key][sub_key]["patterns"]}
                for p in sub_data["patterns"]:
                    if p["id"] not in existing_ids:
                        bank[subject_key][grade_key][sub_key]["patterns"].append(p)

bank_file.write_text(json.dumps(bank, indent=2, ensure_ascii=False), encoding="utf-8")

# Print summary
for subj in ["math","science","english"]:
    for gk in sorted(bank[subj].keys()):
        subs = list(bank[subj][gk].keys())
        print(f"{subj}/{gk}: {len(subs)} subtopics → {', '.join(subs)}")
