# How Weighted Matching Works - Step by Step

## 🎯 **What Happens When You Change Weights**

### **Step 1: Open Find Roommates Tab**
- Go to the "Find Roommates" tab
- You'll see roommate cards with compatibility scores

### **Step 2: Click "Adjust Weights"**
- Click the "Adjust Weights" button in the top-right
- A panel opens with 8 sliders for different factors

### **Step 3: Adjust Importance Levels**
- Each slider goes from 1 (Not Important) to 5 (Critical)
- **Example**: Set "Sleep Schedule" to 5 (Critical) and "Budget" to 2 (Somewhat Important)

### **Step 4: See Real-Time Updates**
- **Loading indicator** appears briefly (500ms)
- **Roommate rankings change** automatically
- **Score breakdowns update** in each card
- **Priority order** shows in the info panel

## 📊 **How Scores Are Calculated**

### **Individual Compatibility Scores**
Each roommate gets scored on 8 factors (0-100 scale):

1. **Budget Compatibility**: How much budget ranges overlap
2. **Sleep Schedule**: Exact match = 100, Flexible = 70, Different = 30
3. **Cleanliness**: Based on level difference (20 points per level)
4. **Social Vibe**: Exact match = 100, Similar = 70, Different = 40
5. **Pet Compatibility**: Mock score (70-100)
6. **Work From Home**: Mock score (70-100)
7. **Guest Frequency**: Mock score (70-100)
8. **Smoking Policy**: Mock score (70-100)

### **Weighted Score Calculation**
```
Weighted Score = (Compatibility Score × Weight) ÷ 5

Example:
- Sleep Schedule: 100 compatibility × 5 weight = 500 ÷ 5 = 100 points
- Budget: 80 compatibility × 2 weight = 160 ÷ 5 = 32 points
- Total: 100 + 32 + other factors = Final Score
```

### **Final Ranking**
- **Total weighted score** calculated for each roommate
- **Roommates sorted** by weighted score (highest first)
- **Score breakdowns** show individual factor contributions

## 🎮 **Try This Demo**

### **Scenario 1: Prioritize Sleep Schedule**
1. Set "Sleep Schedule" to 5 (Critical)
2. Set "Budget" to 1 (Not Important)
3. **Result**: Roommates with matching sleep schedules rank higher

### **Scenario 2: Prioritize Budget**
1. Set "Budget" to 5 (Critical)
2. Set "Sleep Schedule" to 1 (Not Important)
3. **Result**: Roommates with similar budgets rank higher

### **Scenario 3: Balanced Approach**
1. Set "Sleep Schedule" to 4 (Very Important)
2. Set "Cleanliness" to 4 (Very Important)
3. Set "Budget" to 3 (Important)
4. **Result**: Roommates good in multiple areas rank higher

## 📈 **Visual Feedback**

### **In Weight Settings Panel**
- **Color-coded badges**: Gray (1) → Red (5)
- **Priority order**: Shows top 3 most important factors
- **Real-time updates**: Changes apply immediately

### **In Roommate Cards**
- **Weighted Match Score**: New primary score (replaces compatibility)
- **Score Breakdown**: Shows points for each factor
- **Ranking Changes**: Cards reorder based on new weights

### **Loading States**
- **Brief loading** when weights change (500ms)
- **Smooth transitions** for score updates
- **Visual feedback** that recalculation is happening

## 🔍 **Example Walkthrough**

### **Initial State**
- Alex Chen: 92% compatibility
- Sarah Johnson: 87% compatibility  
- Mike Rodriguez: 78% compatibility

### **After Setting Sleep Schedule to 5 (Critical)**
- Alex Chen: 95% weighted (Early bird matches user's Early bird)
- Sarah Johnson: 88% weighted (Flexible is compatible)
- Mike Rodriguez: 82% weighted (Night owl is different)

### **After Setting Budget to 5 (Critical)**
- Sarah Johnson: 94% weighted (Budget range overlaps well)
- Alex Chen: 89% weighted (Budget range overlaps moderately)
- Mike Rodriguez: 85% weighted (Budget range overlaps less)

## 🎯 **Key Benefits**

1. **Personalized Rankings**: Each user gets different results based on their priorities
2. **Transparent Scoring**: See exactly why someone is a good match
3. **Real-Time Updates**: Changes apply immediately
4. **Visual Feedback**: Clear indicators of importance levels
5. **Flexible System**: Easy to adjust priorities anytime

The system now provides a much more intelligent and personalized roommate matching experience! 🎉

