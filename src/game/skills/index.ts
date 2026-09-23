// Side-effect imports: each file registers its SkillImpls.
import './impl/berserker';
import './impl/arcanist';
import './impl/stalker';
import './impl/bonemancer';

export { getSkillImpl, registerSkills, registeredSkillIds } from './registry';
