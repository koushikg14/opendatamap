<?
error_reporting(E_ALL);
$config['Site title'] = "Food Hygiene Map";
$config['Site keywords'] = "Food Hygiene,map,interactive";
$config['Site description'] = "Interactive map showing food establishments and their hygiene ratings";
$config['default lat'] = 52.9355;
$config['default long'] = -1.39595;
$config['default zoom'] = -6;
$config['datasource'] = array('food', 'postcode');
$config['enabled'] = array('search', 'geobutton', 'toggleicons');
$config['categories'] = array();
$config['selection_required'] = true;

$scotland = array(
'Aberdeen_City',
'Aberdeenshire',
'Angus',
'Argyll_and_Bute',
'Clackmannanshire',
'Comhairle_nan_Eilean_Siar_Western_Isles',
'Dundee_City',
'East_Ayrshire',
'East_Dunbartonshire',
'East_Lothian',
'East_Renfrewshire',
'Edinburgh_City_of',
'Falkirk',
'Fife',
'Glasgow_City',
'Highland',
'Inverclyde',
'Midlothian',
'Moray',
'North_Ayrshire',
'Perth_and_Kinross',
'Renfrewshire',
'Scottish_Borders',
'Shetland_Islands',
'South_Ayrshire',
'Stirling',
'West_Dunbartonshire',
);

foreach(glob('/home/opendatamap/opendatamap.ecs.soton.ac.uk/www/htdocs/modules/food/resources/*/*.xml') as $v)
{
	$v = str_replace(array('/home/opendatamap/opendatamap.ecs.soton.ac.uk/www/htdocs/modules/food/resources/', '.xml'), '', $v);
	list($lang, $v) = explode('/', $v, 2);
	$config['versions'][$v]['langs'][] = $lang;
	if(in_array($v, $scotland))
	{
		$config['versions'][$v]['mode'] = 'FHIS';
	}
	else
	{
		$config['versions'][$v]['mode'] = 'FHRS';
	}
	$placename = str_replace('_', ' ', $v);
	$config['versions'][$v]['datafile'] = $v;
	$config['versions'][$v]['Site title'] = "Food Hygiene Map for ".$placename;
	$config['versions'][$v]['Site subtitle'] = $placename;
	$config['versions'][$v]['Site description'] = "Interactive map showing food establishments in ".$placename." and their hygiene ratings";
	$config['versions'][$v]['Site keywords'] = "Food Hygiene,map,interactive,".$placename;
	$config['versions'][$v]['hidden'] = true;
}

if(isset($config['versions'][$versionparts[1]]))
{
	foreach($config['versions'][$versionparts[1]] as $key => $value)
	{
		$config[$key] = $value;
	}
}

if($config['mode'] == 'FHIS')
{
	$config['categories']['food/fhis_improvement_required_en-gb'] = 'Improvement Required';
	$config['categories']['food/fhis_pass_en-gb'] = 'Pass';
	$config['categories']['food/fhis_pass_and_eat_safe_en-gb'] = 'Pass and Eat Safe';
}
else
{
	for($i = 0; $i <= 5; $i++)
	{
		if(count($config['langs']) > 1)
		{
			foreach($config['langs'] as $lang)
			{
				$config['categories']['food/fhrs_'.$i.'_en-gb'][$lang] = t('Food Hygiene Rating', $lang).': '.$i;
			}
			$config['categories']['food/fhrs_'.$i.'_en-gb'] = '<div style="float:left; position:relative; top:-2px; width:90%; font-size: 0.7em;">'.implode('<br />', $config['categories']['food/fhrs_'.$i.'_en-gb']).'</div>';
		}
		else
		{
			$config['categories']['food/fhrs_'.$i.'_en-gb'] = t('Food Hygiene Rating', $lang).': '.$i;
		}
	}
}

function t($str, $lang)
{
	if($str == 'Food Hygiene Rating' && $lang == 'cy-gb')
	{
		return 'Sgôr Hylendid Bwyd';
	}
	return $str;
}
?>
