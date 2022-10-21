/*
    Password regex; requirements:
    - At least 8 characters
    - At least one small letter
    - At least one capital letter
    - At least one number
    - At least one special character
*/
const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[ !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~])[A-Za-z\d !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~&]{8,}$/g;

export default passwordRegex;
