export default `
### Overview

Spatially constrained ICA with NeuroMark utilizes a joint optimization for independence and adherence of spatial constraints to a given template, allowing for the identification of spatially independent components that align well with previously idenfitied networks.

For more information see the original paper from Du et al. 2020.

This computation is designed to run in a federated learning environment; however, all computation operations are currently local as spatially constrained ICA can run on individual participants without sharing information between sites.

### Example Settings

\`\`\`json
{
"refFiles": "Neuromark_fMRI_1.0",
"preproc_type": 1,
"scaleType": 0,
"mask": "default&icv",
"TR": [2],
"perfType": 1,
"dummy_scans": [0],
"prefix": "gica_cmd"
}
\`\`\`

### Settings Specification

| Variable Name | Type | Description | Allowed Options | Default | Required |
| --- | --- | --- | --- | --- | --- |
| \`refFiles\` | \`string\` | The template used as reference for spatially constrained ICA. | Any of the existing templates in GIFT can be specified just by providing the name of the template, with the most commonly used templates being \`\`\` Neuroark_fMRI_1.0\` and Neuromark_fMRI_2.0\` \`\`. Additionally a path to a locally provided template can be used, as long as the path is provided in terms of the docker image filesystem | "Neuromark_fMRI_1.0" | ✅ true |
| \`preproc_type\` | \`number\` | The type of subject-specific additional preprocessing to do prior to running ICA. | 1 - remove mean per timepoint, 2 - remove mean per voxel, 3 - intensity normalization, 4- variance normalization | 1 | ✅ true |
| \`scaleType\` | \`number\` | The type of scaling to apply to components prior to saving. | 0 - don't scale, 1 - scale to percent signal change, 2 - scale to z-scores | 0 | ✅ true |
| \`mask\` | \`string\` | To have GIFT automatically compute masks, use either the \`default\` or \`default&icv\` functions, which compute a mask based on the mean fMRI image (with the ICV image removing eyes); however, these will compute masks locally and may thus differ slightly between sites. A path to a NIFTI file may be provided as long as it is accessible to the computation. The path must be specified in terms of the docker filesystem. | default&ICV, default, or a path to a mask | "default&icv" | ✅ true |
| \`TR\` | \`object\` | The repetition time for each scan as a list of list of floats | List of floats, where the number of TRs is either 1 or equal to the number of subjects | [2] | ✅ true |
| \`perfType\` | \`number\` | the type of performance mode to use in GIFT | 1 - maximize performance, 2 - less memory usage, 3 - user specified settings (NOT RECOMMENDED) | 1 | ✅ true |
| \`dummy_scans\` | \`object\` | the number of scans to remove from each participant | a list of integers, either one integer which is applied to all subjects, or a list with a number equal to the number of subjects | [0] | ✅ true |
| \`prefix\` | \`string\` | the prefix to append to filenames prior to saving | any valid character string | "gica_cmd" | ❌ false |

### Input Description

The computation requires at minimum one valid NIFTI (.nii or .nii.gz) file located in the TOP LEVEL of the input folder, as well as a parameters.json file with the local parameters for the computation.

NIFTI files must contain a valid functional MRI image, i.e. which has 4 dimensions (X,Y,Z,Time) and which is readable using the GIFT toolbox. Corrupt or invalid MRI images will cause an error to be thrown in GIFT.

In the future, computations may require BIDS formatting of input data; however, currently that is not required.

Currently, \`parameters.json\` is considered a local file, so each site can specify slightly different parameters if they desire; however, in most cases, these will be uniform across sites.

### Algorithm Description

1.  **Data Preparation**:

- The computation locates nifti files stored in the input data directory, by searching for any files which match the pattern \`*.nii*\`

- The computation resolves the template argument to either use a preset template included within GIFT, or to use a template hosted on the local filesystem.

- The computation uses local parameters from each site stored in \`local_parameters.json\`. If the desire is to synchronize parameters across sites, this must be done manually.

2.  **Local Spatially Constrained ICA**:

- Local spatially constrained ICA is then performed using the given template and locally specified parameters. This computation bundles all local steps for spatially constrained ICA into one pipeline managed by Nipype and GIFT, including masking, variance or mean removal, local scica optimization, static FNC computation, and report generation.

### Assumptions

For now, it is assumed that each site has NIFTI files located at the TOP LEVEL of their data folder, and that all subjects ought to be included in the analysis. ALL .NIFTI files at the top level of the folder will be included.

It is assumed that standard preprocessing (warping, smoothing ,slice-timing ,etc) has been performed on all data prior to running ICA.

It is assumed that each site has their own set of parameters and will agree on a set of parameters that will allow for data sharing at subsequent stages if desirable. In the future some options may be moved to the server to configure them globally.

### Output Description

Results consist of a number of .mat MATLAB binary files, as well as an HTML report and PNG files which are contained within that report:

*  \`gica_cmd_gica_batch.m\` - a MATLAB script which contains all of the parameters for the local run

*  \`gica_cmdMask.nii\` - the MASK file generated or copied from an existing file

*  \`gica_cmd_ica_br#.mat\` - a MATLAB binary file which contains a single variable:

-  \`compSet\` which is a MATLAB struct with two fields:

-  \`ic\` - the set of (masked) spatially independent components with size

-  \`tc\` - the set of time-series associated with each component with size

This file contains the variables as they are created after back-reconstruction.

One file will be generated for each local participant.

*  \`gica_cmd_ica_c1.mat\` - a MATLAB binary file which contains two variables:

-  \`ic\` - the set of (masked) spatially independent components with size

-  \`tc\` - the set of time-series associated with each component with size

This file is generated following the calibration step in GIFT, which comes after back-reconstruction

*  \`gica_cmd_ica_parameter_info.mat\` - a MATLAB binary file which contains the GIFT parameters used in the the analysis. The file contains a single variable:

-  \`sesInfo\` which contains a number of options that can be configured in GIFT. See below for the parameters that can be set for this computation in particular via the parameters.json file.

*  \`gica_cmd_ica.mat\` - a MATLAB binary file which contains a single variable:

-  \`icasig\` - which contains the (masked) group spatial maps prior to back-reconstruction. The variable has size \`NUM_COMPONENTS x VOX(masked)\`

*  \`gica_cmd_mean_component_ica_s_all_.nii\` - this NIFTI file contains the unmasked mean spatially indepdent components aggregated across participants and sessions.

*  \`gica_cmd_mean_component_ica_s1_.nii\` - this NIFTI file contains the unmasked mean spatially indepdent components aggregated across the first session. This will be the same as the previous variable if there is only one session.

*  \`gica_cmd_mean_timecourses_ica_s_all_.nii\` - this NIFTI file contains the mean time courses for each component aggregated across participants and sessions.

*  \`gica_cmd_mean_timecourses_ica_s1_.nii\` - this NIFTI file contains the mean time courses for each component aggregated across the first session. This will be the same as the previous variable if there is only one session.

*  \`gica_cmd_postprocess_results.mat\` - this file contains local derivatives computed following ICA, such as static functional network connectivity (sFNC) and spectra. The file is a MATLAB binary file which tonains 4 variables:

-  \`aggregate\` - a MATLAB struct with two fields:

-  \`fnc\` - a struct which contains the mean static FNC for the group in the field \`mean\`

-  \`spectra\` - a struct which contains 5 variables: \`mean\` the mean spectral values for each frequency x component, \`ssq\` the sum of squared errors for each frequency x component, \`sem\` the standard error of mean for each frequency x component, \`dynamic_range\` the dynamic range for each frequency, \`fALFF\` the fractional amplitude of low-frequency fluctuations for each frequency, and \`freq\` the values in HZ where each of the frequency metrics are computed.

-  \`components\` - a MATLAB array containing the indices of evaluated components

-  \`postProcessFiles\`- a MATLAB cell containing the names of each postprocessing output file

-  \`subjects\`- the indices of subjects used in the analysis

*  \`gica_cmd_results.log\` - a plain-text log file containing the output from the GIFT toolbox

*  \`gica_cmd_std_component_ica_s1_.nii\` - a NIFTI file containing the standard deviation of the spatial maps across the first session.

*  \`gica_cmd_std_timecourses_ica_s1_.nii\` - a NIFTI file containing the standard deviation of the timecourses across the first session.

*  \`gica_cmd_sub#_component_ica_s1_.nii\` - a NIFTI file containing the unmasked spatially independent components for a particular subject.

*  \`gica_comd_sub#_timecourses_ica_s1_nii\` - a NIFTI file containing the time series

*  \`gica_cmd_tmap_component_ica_s1_.nii\` - a NIFTI file containing the T-maps for of the spatial maps aggregated across the first session.

*  \`gica_cmd_tmap_timecourses_ica_s1_.nii\` - a NIFTI file containing the T-maps for of the time courses aggregated across the first session associated with each component for each subject.

*  \`gica_cmdMask.nii\` - a NIFTI file containing the created or copied mask for the participant.

*  \`gica_cmdSubject.mat\` - a MATLAB binary file containing a 5 variables:

-  \`SPMFiles\` - a list of SPM files provided

-  \`files\` - a struct with the field \`name\` that has the input filenames for each participant

-  \`modalityType\` - a string indicating the modality type

-  \`numOfSess\` - an integer containing the number of sessions

-  \`numOfSub\` - an integer containing the number of subjects

*  \`gica_cmd_gica_results\` - a folder containing the HTML report and images.

*  \`gica_cmd_postprocess_results\` - a folder containing subject-specific post-processing results such as static FNCs and spectra.
`
