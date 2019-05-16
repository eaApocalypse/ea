
var ArmyList = {
	data:{},
	allFormations:[],
	allNonFixedFormations:[],
	init:function(input) {

		this.data = input;
		this.allNonFixedFormations = input.sections.pluck('formations').flatten();
		this.allFormations = input.fixedFormations ? input.fixedFormations.concat( this.allNonFixedFormations )
														  		 : this.allNonFixedFormations;

		// FORMATION UPGRADES...
		this.allFormations.each( function(formation) {
			// fill in empty upgrade lists
			if (!formation.upgrades) formation.upgrades = [];

			// replace upgrade ids with upgrade objects
			formation.upgrades = formation.upgrades.map(function(id) {
				return ArmyList.upgradeForId(id);
			 });
		});

		// UPGRADE CONSTRAINTS...
		input.upgradeConstraints.each( function(constraint) {
			// replace upgrade ids with upgrade objects
			constraint.from = constraint.from.map( ArmyList.upgradeForId );
			// replace formation ids with formation objects
			if (constraint.appliesTo) {
				constraint.appliesTo = constraint.appliesTo.map( ArmyList.formationForId );
			}
			else {
				constraint.appliesTo = ArmyList.allFormations;
			}
			// set some useful properties and defaults
			if (!constraint.min && constraint.max) constraint.min = 0;
			if (constraint.min && !constraint.max) constraint.max = 1000000;
                        if (!constraint.name && constraint.perPoints) constraint.name = constraint.from[0].name;
			constraint.mandatory = constraint.min && !constraint.perArmy;
			constraint.mandatoryWithOptions = constraint.mandatory && constraint.from.length > 1;
		});

		// FORMATION CONSTRAINTS...
		input.formationConstraints.each( function(constraint) {
			// replace formation ids with formation objects
			constraint.from = constraint.from.map( ArmyList.formationForId );
			// replace formation ids with formation objects
			if (constraint.forEach) {
				constraint.forEach = constraint.forEach.map( ArmyList.formationForId );
			}
			// set some useful properties and defaults
                        if (!constraint.min && constraint.max) constraint.min = 0;
			if (constraint.min && !constraint.max) constraint.max = 1000000;
                        if (!constraint.name && constraint.perPoints) constraint.name = constraint.from[0].name;
		});

		// FORMATIONS... add some useful properties/functions...
		this.allFormations.each( function(formation){
			formation.constraints = input.formationConstraints.findAll( function(c) {
				return c.from.member(formation);
			});
			formation.independentConstraints = formation.constraints.findAll( function(c) {
				return !c.maxPercent && !c.perPoints && !c.forEach;
			});
			formation.hasPercentConstraint = formation.constraints.any( function(c) {
				return c.maxPercent;
			});

			// upgrade constraints...
			formation.upgradeConstraints =
				ArmyList.data.upgradeConstraints.filter( function(x){
					return x.appliesTo.member(formation);
				});
			formation.mandatoryUpgradeConstraints =
				formation.upgradeConstraints.filter( function(x){
					return x.mandatory;
				});
			formation.mandatoryConstraint = function(upgrade){
				return formation.mandatoryUpgradeConstraints.find( function(constraint){
						return constraint.from.member(upgrade);
					});
			};
			formation.replaceable = function(upgrade){
				return formation.mandatoryConstraint(upgrade)
							&& formation.mandatoryConstraint(upgrade).mandatoryWithOptions;
			};
			formation.constraintsOn = function(upgrade){
				return formation.upgradeConstraints.findAll( function(c){return c.from.member(upgrade);} );
			};
			formation.optionsFor = function(upgrade){
				var constraint = formation.mandatoryConstraint(upgrade);
				return constraint ? constraint.from.without(upgrade) : [];
			};
			formation.defaultUpgrades = function(){
				var defaults = [];
				formation.mandatoryUpgradeConstraints.each( function(x) {
					for (var i=0;i<x.min;i++){
						var xx = x.from[0];
						if(x.composite){
							xx.composite = x.composite;
						}
						defaults.push( xx );
					}
				});
				return defaults;
			};
			// cost including any mandatory upgrades... add them in too!
			var total = 0;
			formation.mandatoryUpgradeConstraints.each( function(x) {
				if (Array.isArray(x.from[0].pts)) {
					for(var i=0; i < x.min; i++) {
						total += x.from[0].pts[i % x.from[0].pts.length];
					}
				} else {
					total += x.min * x.from[0].pts;
				}
			});
			formation.cost = formation.pts + total;
		});
	},
	addReferences:function(content, fileType){
		if(!this.data.xref){
			this.data.xref = [];
		}
		this.data.xref.push({"fileType":fileType, "content":content});
	},
	getStats:function(xref){
		var xxxx = this.data.xref.findAll(function(xr) {
			return xr.fileType == "primary" || xr.fileType == "allies";
		});
		var unit = null;
		xxxx.each(function(fil) {
			if( unit == null){
				unit = fil.content[0].unit.find(function(uu) {
					return uu.name.toLowerCase() == xref.toLowerCase();
				});
			}
		});
		return unit;
	},
	getSpecialRule:function(title){
		var xxxx = this.data.xref.findAll(function(xr) {
			return xr.fileType == "primary" || xr.fileType == "allies";
		});
		var specialRule = null;
		xxxx.each(function(fil) {
			if( specialRule == null){
				specialRule = fil.content[0].specialRules.find(function(uu) {
					return uu.title.toLowerCase() == title.toLowerCase();
				});
			}
		});
		return specialRule;
	},
	getWeapon:function(name){
		var xxxx = this.data.xref.findAll(function(xr) {
			return xr.fileType == "common";
		});
		var weapon = null;
		xxxx.each(function(fil) {
			if( weapon == null){
				weapon = fil.content.weapons.find(function(uu) {
					return uu.name.toLowerCase() == name.toLowerCase();
				});
			}
		});
		return weapon;
	},
	getArmyStats:function(){
		var xxxx = this.data.xref.findAll(function(xr) {
			return xr.fileType == "primary";
		});
		var primary = null;
			xxxx.each(function(fil) {
			if( primary == null){
				if(fil.content[0].armyStats){
					primary = fil.content[0].armyStats;
				}
			}
		});
		return primary;
	},
	upgradeForId:function(id) {
		return ArmyList.data.upgrades.find( function(x) { return x.id == id; });
	},
	upgradeIsComposite:function(upgrade){
		var shortList = ArmyList.data.upgradeConstraints.findAll( function(constraint) {
			return constraint.from.indexOf(upgrade) != -1 && constraint.composite;
		});
		return shortList.length > 0;
	},
	formationForId:function(id) {
		return ArmyList.allFormations.find( function(x){ return x.id == id; });
	},

/////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////
	violatedPercent:function(pts,constraint,formationPts){
		if (constraint.maxPercent) {
			var tooMany = (formationPts > 0) && (formationPts/pts)*100 > constraint.maxPercent;
			if (tooMany) return 'more than ' +constraint.maxPercent+ '% spent on ' + constraint.name;
		}
		return '';
	},
	violatedMandatory:function(constraint){
		return 'mandatory upgrade not included in any formations: ' + constraint.name;
	},
	violatedMandatoryUpgrade:function(constraint, formation){
		return 'mandatory upgrade not included in formation: ' + formation.type.name + ' -> ' + constraint.name;
	},
	violatedTransport:function(constraint,formationName){
		return 'transport max exceeded: ' + formationName;
	},
    roundUp:function(pts,increment) {
        var x = increment;
        while(x < pts) {
            x += increment;
        }
        return x;
    },
	violated:function(pts,formations,constraint) {
		if (constraint.perPoints && constraint.max) {
                        var slots = ArmyList.roundUp(pts,constraint.perPoints) / constraint.perPoints;
			var tooMany = formations.countAll(constraint.from) > slots * constraint.max;
			if (tooMany) return 'more than ' +constraint.max+ ' ' +constraint.name+ ' per ' +constraint.perPoints+ ' points';
		}
		if (constraint.perPoints && constraint.min) {
                        var slots = ArmyList.roundUp(pts,constraint.perPoints) / constraint.perPoints;
                        var tooFew = formations.countAll(constraint.from) < slots * constraint.min;
			if (tooFew) return 'less than ' +constraint.min+ ' ' +constraint.name+ ' per ' +constraint.perPoints+ ' points';
		}
		if (constraint.forEach && constraint.max) {
			var tooMany = formations.countAll(constraint.from) > formations.countAll(constraint.forEach) * constraint.max;
			if (tooMany) return 'more than ' +constraint.max+' '+constraint.name+ ' per ' +constraint.name2;
		}
		if (constraint.forEach && constraint.min) {
			var tooFew = formations.countAll(constraint.from) < formations.countAll(constraint.forEach) * constraint.min;
			if (tooMany) return 'less than ' +constraint.min+' '+constraint.name+ ' per ' +constraint.name2;
		}

		return '';
	},
        canRemoveFormation:function(formations,constraint) {
//            alert(constraint.min + ' ' + formations.length + ' ' + formations.countAll(constraint.from));
            return !constraint.min || constraint.perPoints || (constraint.min < formations.countAll(constraint.from));
        },
	canAddFormation:function(formations,constraint) {
//		alert(formations.length + '_' + constraint.max  + '_' + constraint.from.length + '_' + constraint.name);
		if (constraint.max <= formations.countAll(constraint.from)) {
			return ArmyList.maxString( constraint, true );
		}
		return '';
	},
	canAddUpgrade:function(upgrades,constraint,upgradeType) {
		if(constraint.exclusive){
			if (constraint.max == upgrades.countExclusive(constraint.from, upgradeType)) {
				return ArmyList.maxString( constraint );
			}
		}
		if(constraint.weighted){
			var addWeight = 0;
			upgrades.each(function(u) {
				if( u.addweight ){
					addWeight += u.addweight;
				}
			});

			if (constraint.max + addWeight + 1 <= upgrades.countWeighted(constraint.from, upgradeType.weight)) {
				return ArmyList.maxStringPlus( constraint, true, constraint.max + addWeight );
			}
		}
		if(!constraint.weighted && !constraint.exclusive){
			if (constraint.max <= upgrades.countAll(constraint.from)) {
				return ArmyList.maxString( constraint );
			}
		}
		return '';
	},
	maxStringPlus:function(constraint, ignorePerArmy, useMax) {
		return (constraint.exclusive ? 'exclusive' : ((constraint.weighted ? 'group max ' : 'max ') + (useMax ? useMax : constraint.max)) )
			+ (constraint.name ? ' ' + constraint.name : '')
			+ (constraint.perArmy && !ignorePerArmy ? ' per Army' : '');
	},
	maxString:function(constraint, ignorePerArmy) {
		return 'max ' + constraint.max
				+ (constraint.name ? ' ' + constraint.name : '')
				+ (constraint.perArmy && !ignorePerArmy ? ' per Army' : '');
	},
    mandatoryFormations:function() {
        var mandatoryFormations = [];
        ArmyList.data.formationConstraints.each( function(constraint) {
            for (var i=0; i<constraint.min && !constraint.perPoints; i++) {
                mandatoryFormations.push( constraint.from[0] );
            }
        });
        return mandatoryFormations;
    }
};
