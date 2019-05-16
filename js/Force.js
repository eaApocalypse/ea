
var Force = {
	nextId:0,
	name:'Incompertus',
	formations:[], //{id:i, type:t, upgrades:[u1,u2,u2,u2,u3,u4,u4]}
	calcPoints:function() {
		var total = 0;
		this.formations.each( function(x) {
			total += x.calcPoints();
		});
		return total;
	},
	addFormation:function(formationType, noDefaults) {
		var formation = {
								id:Force.nextId++,
								type:formationType,
								upgrades:noDefaults ? [] : formationType.defaultUpgrades(),
								count:function(upgradeType) {
									return this.upgrades.count(upgradeType);
								},
								calcPoints:function() {
									var total = this.type.pts;
									var counted = {}

									this.upgrades.each(function(u) {
											if (Array.isArray(u.pts)) {
												counted[u.name] = counted[u.name] == undefined ? 0 : counted[u.name] + 1;
												total += u.pts[counted[u.name] % u.pts.length];
											}
											else {
												total += u.pts;
											}
									});

									return total;
								},
								canRemove:function(upgradeType) {
									// check minimum constraint
									var constraint = this.type.mandatoryConstraint( upgradeType );
									if (constraint) {
										var total = this.upgrades.countAll( constraint.from );
										return total > constraint.min;
									}
									return true;
								},
								cannotAdd:function(upgradeType) {
									var why = [];
									var upgrades = this.upgrades;
									var allUpgrades = Force.allUpgrades();
									this.type.constraintsOn(upgradeType).each( function(c) {
										var w = ArmyList.canAddUpgrade( c.perArmy ? allUpgrades : upgrades, c, upgradeType );
										if( why.indexOf(w) == -1 ){
											why.push(w);
										}
									});
									return why.without('');
								},
								cannotSwap:function(upgradeType,swapType) {
									if( upgradeType.composite ){
										swapType.composite = upgradeType.composite;
									}
									var why = [];
									var upgrades = [].concat(this.upgrades).remove( upgradeType );
									var allUpgrades = Force.allUpgrades().remove( upgradeType );
									this.type.constraintsOn(swapType).each( function(c) {
										why.push( ArmyList.canAddUpgrade( c.perArmy ? allUpgrades : upgrades, c ) );
									});
									return why.without('');
								}
							};
		this.formations.push( formation );
		return formation;
	},
	getWarnings:function(){
		var msgs = [];
		ArmyList.data.formationConstraints.each(function(c) {
			if (c.maxPercent) {
				var points = 0;
				Force.formations.each( function(f){
					if (c.from.member(f.type)) {
						points += f.calcPoints();
					}
				});
				msgs.push( ArmyList.violatedPercent(Force.calcPoints(), c, points) );
			} else if (c.mandatoryUpgrade) {
				if( c.perArmy ){
					var hasUpgrade = false;
					Force.formations.each( function(f){
						f.upgrades.each( function(u){
							if( c.includeUpgrade.indexOf(u.id) != -1 ) {
								hasUpgrade = true;
							}
						});
					});
					if( !hasUpgrade ){
						msgs.push( ArmyList.violatedMandatory(c) );
					}
				}
				else{	//per formation
					Force.formations.each( function(f){
						var hasUpgrade = false;
						var isRequired = false;
						c.from.each(function(cf){
							if( cf.id == f.type.id){
								isRequired = true;
							}
						});

						if(isRequired){
							f.upgrades.each( function(u){
								if( c.includeUpgrade.indexOf(u.id) != -1 ) {
									hasUpgrade = true;
								}
							});
							if( !hasUpgrade ){
								msgs.push( ArmyList.violatedMandatoryUpgrade(c,f) );
							}
						}
					});
				}
			} else if (c.transportsExceeded) {
				var maxExceeded = false;
				Force.formations.each( function(f){
					f.type.upgradeConstraints.each( function(cc) {
						if(cc.weighted){
							var addWeight = 0;
							f.upgrades.each(function(u) {
								if( u.addweight ){
									addWeight += u.addweight;
								}
							});
							if (cc.max + addWeight + 1 <= f.upgrades.countWeighted(cc.from, 0)) {
								maxExceeded = true;
							}
						}
					});
					if( maxExceeded ){
						msgs.push( ArmyList.violatedTransport(c, f.type.name) );
					}
					maxExceeded = false;
				});
			} else {
				msgs.push( ArmyList.violated(Force.calcPoints(), Force.formations.pluck('type'), c) );
			}
		});
		return msgs.without('');
	},
	cannotAdd:function(formationType){
//		alert(formationType.name + formationType.constraints.length);
		var why = [];
		formationType.independentConstraints.each(function(c) {
			why.push( ArmyList.canAddFormation( Force.formations.pluck('type'), c ) );
		});
		return why.without('');
	},
    canRemove:function(formation){
        var type = formation.type;
        return !type.constraints || type.constraints.all( ArmyList.canRemoveFormation.curry( Force.formations.pluck('type') ) );
    },
	allUpgrades:function() {
		return Force.formations.pluck('upgrades').flatten();
	},
	pickle:function() {
		var out = Force.name;
		Force.formations.each( function(x) {
			out += '~' + x.type.id;
			x.upgrades.uniq().each( function(u) {
				out += '~' + u.id + 'x' + x.count(u);
			});
		});
		return out;
	},
	unpickle:function(pickled) {
		try {
			Force.name = null;
			var currentFormation = null;
			decodeURIComponent(pickled).split('~').each(function(x) {
				if (!Force.name) {
					Force.name = x;
				}
				else {
					var id = parseInt(x.split('x')[0]);
					if (id >= 500) {
						currentFormation = Force.addFormation( ArmyList.formationForId(id), true );
					}
					else {
						var count = parseInt(x.split('x')[1]);
						for (var i=0;i<count;i++) {
							var addUpgrade = ArmyList.upgradeForId(id)
							if( ArmyList.upgradeIsComposite(addUpgrade) ){
								addUpgrade.composite = true;
							}
							currentFormation.upgrades.push( addUpgrade );
						}
					}
				}
			});
			return name;
		}
		catch(err) {
			alert('Sorry, there was an error loading the army.');
		}
	},
	plainText:function() {
		var txt = Force.name + ', ' + Force.calcPoints() + ' POINTS \n';
		txt += ArmyList.data.id + ' (' + ArmyList.data.version + ') \n';
		txt += '================================================== \n';
		Force.formations.each( function(x) {
			txt += '\n' + x.type.name.toUpperCase() + ' ['+ x.calcPoints() +'] \n';
			var units =	x.upgrades.uniq().map( function(upgrade) {
				return (x.count(upgrade) > 1 ? x.count(upgrade) + ' ' : '') + upgrade.name;
			});
			if (x.type.units) {
				units = [x.type.units].concat( units );
			}
			txt += units.join(', ');
			txt += units.empty() ? '' : '\n';
		});
		txt += '\n\n';
		return txt;
	},

	buildHeader:function(x){
		var txt = '';

		//list formation name and points
		txt += '<div class="divRowMain">' + '<b>' + x.type.name.toUpperCase() + '</b>' + ' ('+ x.calcPoints() +'pts)</div>';

		var units = [];
		if(x.type.xref)	{	// if the main formation has the xref then this IS used.

			//list upgrade formation elements
			var units =	x.upgrades.uniq().map( function(upgrade) {
				var upPoints = x.count(upgrade) * upgrade.pts;
				return (x.count(upgrade) > 1 ? x.count(upgrade) + ' ' : '') + upgrade.name + ( upPoints != 0 ? '(' + upPoints + 'pts)' : '');
			});
			units = units.findAll(function(f) {		//filter out any dross
				return typeof f != 'undefined';
			});

			// add the main formation element
			if (x.type.units) {
				units = [x.type.units + ' (' + x.type.pts + 'pts)'].concat( units );
			}
		} else {		// if the main formation has the xref then this is not used.
						// if the main formation is a composite grouping (multiple, optional upgrades)   i.e. predators, knights
						//  then we're trying to format that information satisfactorily.
						//  typically a group like this will have min:4 max:4 in the upgrade parameters
						//   it could also have min:1 max:1
						//  these indicate 'swap' options.

			// parse units where not compositeBaseUnits
			var units =	x.upgrades.uniq().map( function(upgrade) {
				if( !upgrade.composite ){
					var upPoints = x.count(upgrade) * upgrade.pts;
					return (x.count(upgrade) > 1 ? x.count(upgrade) + ' ' : '') + upgrade.name + ( upPoints != 0 ? ' (' + upPoints + 'pts)' : '');
				}
			});
			units = units.findAll(function(f) {		//filter out any dross
				return typeof f != 'undefined';
			});

			// then parse units that make up the compositeBaseUnit
			var compPts = 0;
			var compUnit =	x.upgrades.uniq().map( function(upgrade) {
				if( upgrade.composite ){
					var upPoints = x.count(upgrade) * upgrade.pts;
					compPts += upPoints;
					return (x.count(upgrade) > 1 ? x.count(upgrade) + ' ' : '') + upgrade.name + ( upPoints != 0 ? ' (' + upPoints + 'pts)' : '');
				}
			});
			compUnit = compUnit.findAll(function(f) {		//filter out any dross
				return typeof f != 'undefined';
			});

			var str = compUnit.join(' + ') + (x.type.pts + compPts == 0 ? '' : ' (' + (x.type.pts  + compPts) + 'pts)');
			if( str != '' ) {
				units = [str].concat( units );
			}
		}


		txt += '<div class="divRowComposition">';
		txt += units.join(', ');
		txt += units.empty() ? '' : '</br>';
		txt += '</div>';

		txt += '<table>';

		txt += '<tr class="trStatHeader">';
		txt += '<td class="td180">Name</td><td class="td40">Type</td><td class="td40">Speed</td>';
		txt += '<td class="td40">Armour</td><td class="td40">CC</td><td class="td40">FF</td>';
		txt += '<td class="td180">Weapons</td><td class="td40">Range</td><td class="td150">Firepower</td><td class="td100">Notes</td>';
		txt += '<td class="td150">Unit Special Rules</td>';
		txt += '<td class="td100">Unit Notes</td>';
		txt += '</tr>';

		return txt;
	},

	buildRow:function(thisXref, cumulative){
		var txt = '';

		var u = ArmyList.getStats(thisXref);

		if(u){
			txt += '<tr>';
			txt += '<td><b>' + (u.name ? u.name : '-' )+ '</b></td>';
			txt += '<td>' + (u.type ? u.type : '-' )+ '</td>';
			if( u.speed ){
				if(Number.isNaN(Number(u.speed))){
					txt += '<td>' + u.speed + '</td>';
				} else {
					txt += '<td>' + u.speed + 'cm' + '</td>';
				}
			} else {
				txt += '<td>' + '-' + '</td>';
			}
			txt += '<td>' + (u.armour ? u.armour : '-' )+ '</td>';
			txt += '<td>' + (u.cc ? u.cc : '-' )+ '</td>';
			txt += '<td>' + (u.ff ? u.ff : '-' )+ '</td>';


			if(u.weapons){
				let wArray = new Array();

				txt += '<td>';
				let wpn = '';
				for(var i = 0; i < u.weapons.length; i++){
					if( u.weapons[i].name){
						wpn = u.weapons[i].name;
					} else {
						wpn = u.weapons[i];
					}
					txt += wpn + '</br>';

					let w = ArmyList.getWeapon(wpn.split('|')[0]);
					if(w) {
						wArray.push(w);
					}
				}
				txt += '</td>';

				txt += '<td>';
				for(var i = 0; i < wArray.length; i++){
					for(var ii = 0; ii < wArray[i].modes.length; ii++){
						if( wArray[i].modes[ii].range ){
							if(Number.isNaN(Number(wArray[i].modes[ii].range))){
								txt += wArray[i].modes[ii].range + '</br>';
							} else {
								txt += wArray[i].modes[ii].range + 'cm</br>';
							}
						} else {
							txt += '-</br>';
						}
					}
				}
				txt += '</td>';

				txt += '<td>';
				for(var i = 0; i < wArray.length; i++){
					for(var ii = 0; ii < wArray[i].modes.length; ii++){
						if( wArray[i].modes[ii].firepower ){
							if(wArray[i].modes[ii].range) {
								txt += wArray[i].modes[ii].firepower + '</br>';
							} else {
								txt += '(' + wArray[i].modes[ii].firepower + ')</br>';
							}
						} else {
							txt += '-</br>';
						}
					}
				}
				txt += '</td>';

				txt += '<td>';
				for(var i = 0; i < wArray.length; i++){
					for(var ii = 0; ii < wArray[i].modes.length; ii++){
						if( wArray[i].modes[ii].specialRules ){
							if( wArray[i].modes[ii].specialRules.length > 0 ){
								wArray[i].modes[ii].specialRules.each(function(sr){
									txt += sr + ' ';
								});
								txt += '</br>';
							}
							else {
								txt += '-</br>';
							}
						} else {
							txt += '-</br>';
						}
					}
				}
				txt += '</td>';
			}

			txt += '<td>';
			if(u.specialRules){
				if(u.specialRules.length > 0){
					for(var i = 0; i < u.specialRules.length; i++){
						txt += u.specialRules[i] + '</br>';
					}
				} else {
					txt += '-</br>';
				}
			} else {
				txt += '-</br>';
			}
			txt += '</td>';

			txt += '<td>';
			if(u.notes){
				if(u.notes.length > 0){
					txt += '*' + (cumulative.length+1) + '</br>';
					cumulative.push('*' + (cumulative.length+1) + ' [<i>' + u.name + '</i>]: ' + u.notes);
				} else {
					txt += '-</br>';
				}
			} else {
				txt += '-</br>';
			}
			txt += '</td>';

			txt += '</tr>';
		}

		return txt;
	},

	statText:function() {
		var txt = '';
		txt += '<b>' + Force.name + ', ' + Force.calcPoints() + ' POINTS</b></br>';
		txt += ArmyList.data.id + ' (' + ArmyList.data.version + ')</br></br>';

		var armyStats = ArmyList.getArmyStats();
		if(armyStats){
			txt += armyStats.strategy + '</br>';
			txt += armyStats.initiative + '</br></br><br>';
		}

		txt += '<u><b>Formations</b></u></br></br>';
		txt += ''.padEnd(180,'=') + '</br></br>';
		Force.formations.each( function(xx) {

			var cumulative = []

			txt += '<div class="divOuter">';
			txt += Force.buildHeader(xx);

			var collectUnits = [];
			if(xx.type.xref){									// first parse the base formation (if required)
				for( var i = 0; i < xx.type.xref.length; i++){
					collectUnits.push(xx.type.xref[i]);
				}
			}
			xx.upgrades.uniq().each( function(ff) {				// then parse the selected upgrades
				if(ff.xref){
					for( var i = 0; i < ff.xref.length; i++){
						collectUnits.push(ff.xref[i]);
					}
				}
			});
			collectUnits.uniq().each( function(uName) {			//then process one of each unit type
				txt += Force.buildRow(uName, cumulative);
			});


			if( cumulative.length > 0){
				txt += '<tr><td colspan="12">';
				txt += '<div class="divOuter">';
				txt += '<u>Unit Notes</u><br>';
				cumulative.each( function(cc) {
					txt += cc + '</br>';
				});
				txt += '</div>';	// divOuter
				txt += '</td></tr>';
			}

			txt += '</table>';	// divStatList
			txt += ''.padEnd(180,'=') + '</br></br>';
			txt += '</div>';	// divOuter
		});

		txt += '</br>';


		txt += '<div class="divOuter">';

		txt += '<u><b>Army Special Rules</b></u></br></br>';
		ArmyList.data.specialRules.each( function(xx) {
			txt += '<b>' + xx.title + '</b></br>';
			var sr = ArmyList.getSpecialRule(xx.title);
			if(sr){
				sr.description.each(function(srr){		//description is an array of lines. put a break between each.
					txt += srr + '</br>';
				});
			}
			txt += '</br>';
		});
		txt += '</div>';	// divOuter

		return txt;
	}
};
