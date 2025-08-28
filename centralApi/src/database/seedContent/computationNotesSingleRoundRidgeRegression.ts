export default `
### Computation Description for \`single_round_ridge_regression\`

#### Overview
The \`single_round_ridge_regression\` computation performs a ridge regression on the merged datasets from multiple sites using specified covariates and dependent variables. This computation is designed to run within a federated learning environment, where each site performs a local regression analysis, and then global results are aggregated.

The key steps of the algorithm include:

1. **Local Ridge Regression (per site)**:
   - Each site runs ridge regression on its local data, standardizing the covariates and regressing against one or more dependent variables.
   - Statistical metrics (e.g., t-values, p-values, R-squared) are calculated using an ordinary least squares (OLS) model to provide interpretability.

2. **Global Aggregation (controller)**:
   - After each site computes its local regression results, the controller aggregates the results by performing a weighted averaging of the coefficients and other statistics based on the number of subjects (degrees of freedom) per site.

#### Detailed Steps

1. **Data Preparation**:
   - The computation reads covariate and dependent variable data from CSV files (\`covariates.csv\` and \`data.csv\` respectively).
   - Covariates are standardized using z-scores, and an intercept term is added.
   
2. **Ridge Regression**:
   - The computation fits a ridge regression model (with alpha = 1.0) to the standardized covariates and dependent variables.
   - The resulting coefficients are stored for each dependent variable.

3. **OLS Model for Statistical Metrics**:
   - To compute additional statistics (t-values, p-values, R-squared), an OLS model is fitted using the same covariates and dependent variables.
   - The computation extracts these metrics to provide more detailed insights beyond the ridge regression coefficients.

4. **Result Storage (per site)**:
   - Each site's regression results are saved locally in JSON format (\`site_regression_result.json\`), including:
     - Coefficients
     - t-Statistics
     - p-Values
     - R-Squared
     - Degrees of Freedom
     - Sum of Squared Errors (SSE)

5. **Global Aggregation**:
   - The controller aggregates the results from all sites. This involves:
     - Weighted averaging of the coefficients, t-statistics, p-values, and R-squared, using the number of subjects (derived from degrees of freedom) as weights.
     - Summing degrees of freedom and SSE across all sites to get global values.
   
6. **Global Results**:
   - The aggregated global results are saved as \`global_regression_result.json\` and include:
     - Weighted average coefficients
     - Weighted average t-Statistics
     - Weighted average p-values
     - Global R-squared
     - Total degrees of freedom
     - Global SSE

---

#### Data Format Specification

The computation requires two CSV files as input:

1. **Covariates File (\`covariates.csv\`)**
2. **Dependent Variables File (\`data.csv\`)**

Both files must follow a consistent format, though the specific covariates and dependents may vary from study to study based on the \`parameters.json\` file. The computation expects these files to match the covariate and dependent variable names specified in the \`parameters.json\` file.

##### Covariates File (\`covariates.csv\`)

- **Format**: CSV (Comma-Separated Values)
- **Headers**: The file must include a header row where each column name corresponds to a covariate specified in the \`parameters.json\`.
- **Rows**: Each row represents a subject, where each column contains the value for a specific covariate.
- **Variable Names**: The names of the covariates in the header must match the entries in the \`"Covariates"\` section of the \`parameters.json\`.

**General Structure**:
\`\`\`csv
<Covariate_1>,<Covariate_2>,...,<Covariate_N>
<value_1>,<value_2>,...,<value_N>
<value_1>,<value_2>,...,<value_N>
...
\`\`\`

**Example (\`covariates.csv\`)**:
\`\`\`csv
MDD,Age,Sex,ICV
0,35,0,1500000
1,42,1,1485000
0,29,0,1550000
1,56,1,1490000
\`\`\`

##### Dependent Variables File (\`data.csv\`)

- **Format**: CSV (Comma-Separated Values)
- **Headers**: The file must include a header row where each column name corresponds to a dependent variable specified in the \`parameters.json\`.
- **Rows**: Each row represents the same subject as in the \`covariates.csv\`, with values for the dependent variables.
- **Variable Names**: The names of the dependent variables in the header must match the entries in the \`"Dependents"\` section of the \`parameters.json\`.

**General Structure**:
\`\`\`csv
<Dependent_1>,<Dependent_2>,...,<Dependent_N>
<value_1>,<value_2>,...,<value_N>
<value_1>,<value_2>,...,<value_N>
...
\`\`\`

**Example (\`data.csv\`)**:
\`\`\`csv
L_hippo,R_hippo,Tot_hippo
4500,4700,9200
4300,4600,8900
4400,4800,9200
4200,4500,8700
\`\`\`

---

#### Assumptions
- The data provided by each site follows the specified format (standardized covariate and dependent variable headers).
- The computation is run in a federated environment, and each site contributes valid data.

#### Example

- **Input (parameters.json)**:
   \`\`\`json
   {
     "Covariates": ["MDD", "Age", "Sex", "ICV"],
     "Dependents": ["L_hippo", "R_hippo", "Tot_hippo"]
   }
   \`\`\`

- **Local Output (site_regression_result.json)**:
   \`\`\`json
   {
     "L_hippo": {
       "Variables": ["Intercept", "MDD", "Age", "Sex", "ICV"],
       "Coefficients": [0.3, 1.1, 0.05, -0.4, 2.2],
       "t-Statistics": [2.8, 4.2, 0.9, -1.5, 3.8],
       "P-Values": [0.005, 0.001, 0.35, 0.15, 0.002],
       "R-Squared": 0.78,
       "Degrees of Freedom": 95,
       "Sum of Squared Errors": 10.7
     },
     "R_hippo": {
       "Variables": ["Intercept", "MDD", "Age", "Sex", "ICV"],
       "Coefficients": [0.25, 0.9, 0.03, -0.2, 1.9],
       "t-Statistics": [2.6, 3.9, 0.6, -1.3, 3.5],
       "P-Values": [0.01, 0.0015, 0.4, 0.18, 0.003],
       "R-Squared": 0.75,
       "Degrees of Freedom": 95,
       "Sum of Squared Errors": 11.2
     },
     "Tot_hippo": {
       "Variables": ["Intercept", "MDD", "Age", "Sex", "ICV"],
       "Coefficients": [0.5, 1.5, 0.08, -0.3, 3.0],
       "t-Statistics": [3.2, 4.8, 1.2, -1.4, 4.2],
       "P-Values": [0.003, 0.0005, 0.28, 0.17, 0.001],
       "R-Squared": 0.82,
       "Degrees of Freedom": 95,
       "Sum of Squared Errors": 9.8
     }
   }
   \`\`\`

- **Global Output (global_regression_result.json)**:
   \`\`\`json
   {
     "L_hippo": {
       "Variables": ["Intercept", "MDD", "Age", "Sex", "ICV"],
       "Coefficients": [0.35, 1.2, 0.06, -0.3, 2.3],
       "t-Statistics": [2.9, 4.3, 1.0, -1.4, 3.7],
       "P-Values": [0.004, 0.0008, 0.33, 0.16, 0.0025],
       "R-Squared": 0.79,
       "Degrees of Freedom": 290,
       "Sum of Squared Errors": 32.5
     },
     "R_hippo": {
       "Variables": ["Intercept", "MDD", "Age", "Sex", "ICV"],
       "Coefficients": [0.27, 1.0, 0.04, -0.2, 2.0],
       "t-Statistics": [2.7,4.0, 0.8, -1.2, 3.6],
       "P-Values": [0.009, 0.0012, 0.38, 0.18, 0.0028],
       "R-Squared": 0.76,
       "Degrees of Freedom": 290,
       "Sum of Squared Errors": 33.6
     },
     "Tot_hippo": {
       "Variables": ["Intercept", "MDD", "Age", "Sex", "ICV"],
       "Coefficients": [0.55, 1.6, 0.09, -0.25, 3.1],
       "t-Statistics": [3.4, 5.0, 1.3, -1.3, 4.5],
       "P-Values": [0.002, 0.0004, 0.27, 0.15, 0.0015],
       "R-Squared": 0.83,
       "Degrees of Freedom": 290,
       "Sum of Squared Errors": 29.9
     }
   }
   \`\`\`

#### Output Description
The computation outputs both **site-level** and **global-level** results, which include:
- **Coefficients**: Ridge regression coefficients for each covariate.
- **t-Statistics**: Statistical significance for each coefficient.
- **P-Values**: Probability values indicating significance.
- **R-Squared**: The proportion of variance explained by the model.
- **Degrees of Freedom**: The degrees of freedom used in the regression.
- **Sum of Squared Errors (SSE)**: A measure of the model’s error.

# TODO
- Explicitly specify types in parameters.json
  - Only allow numeric and boolean types
`
