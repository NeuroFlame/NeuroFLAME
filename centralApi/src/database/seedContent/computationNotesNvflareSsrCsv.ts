export default `

COINSTAC/NVFlare Code for Single-Shot Regression (SSR) on CSV Based Data

### Example Parameters
\`\`\`
{
    "Dependents": {
        "L_hippo":"int",
        "R_hippo":"int",
        "Tot_hippo":"int"
    },
    "Covariates": {
        "MDD":"bool",
        "Age":"int",
        "Sex":"int",
        "ICV":"int"
    },
    "Lambda": 0
}
\`\`\`

Use data helper to generate parameters based your covariates.csv and data.csv files: [Link Here](https://trendscenter.github.io/nvflare-ssr-csv-helper/build/index.html)

### Example Data Format
This application/algorithm requires two files per participating site:
1. covarariates.csv
2. data.csv

**covariates.csv**
\`\`\`
MDD,Age,Sex,ICV
True,36,1,1440000
True,35,0,1070000
True,44,1,1420000
...
\`\`\`

**data.csv**
\`\`\`
L_hippo,R_hippo,Tot_hippo
3921.5,4212.6,8134.1
3881.9,4099,7980.9
3896.7,4153.2,8049.9
...
\`\`\`

`