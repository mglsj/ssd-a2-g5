#!/usr/bin/env python3
import argparse
import math
import os
import random
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("Error: psycopg2-binary not installed. Run: uv sync (in data_generation/)")
    sys.exit(1)

try:
    from faker import Faker
except ImportError:
    print("Error: faker not installed. Run: uv sync (in data_generation/)")
    sys.exit(1)


fake = Faker("en_IN")
Faker.seed(42)
random.seed(42)


GUEST_COUNT = 10000
PROPERTY_COUNT = 1000
BOOKING_COUNT = 50000
AUDIT_LOG_COUNT = 100000
BATCH_SIZE = 5000
HISTORY_DAYS = 365
CENT = Decimal("0.01")

LOCALITIES = [
    ("Gachibowli", 17.4455, 78.3489, 0.14),
    ("DLF Cyber City", 17.4495, 78.3570, 0.08),
    ("Financial District", 17.4146, 78.3434, 0.08),
    ("Wipro Circle", 17.4250, 78.3470, 0.05),
    ("Kondapur", 17.4696, 78.3578, 0.08),
    ("Botanical Garden", 17.4590, 78.3560, 0.04),
    ("HITEC City", 17.4435, 78.3772, 0.09),
    ("Madhapur", 17.4483, 78.3915, 0.07),
    ("Raidurg", 17.4265, 78.3830, 0.05),
    ("Manikonda", 17.4050, 78.3860, 0.04),
    ("Kokapet", 17.3960, 78.3280, 0.04),
    ("Narsingi", 17.3880, 78.3560, 0.03),
    ("Tellapur", 17.4620, 78.2940, 0.02),
    ("Hafeezpet", 17.4840, 78.3620, 0.03),
    ("Miyapur", 17.4960, 78.3570, 0.03),
    ("Kukatpally", 17.4948, 78.3996, 0.03),
    ("Jubilee Hills", 17.4326, 78.4071, 0.04),
    ("Banjara Hills", 17.4156, 78.4347, 0.03),
    ("Film Nagar", 17.4150, 78.4100, 0.02),
    ("Ameerpet", 17.4375, 78.4482, 0.06),
    ("Begumpet", 17.4447, 78.4664, 0.06),
    ("Secunderabad", 17.4399, 78.4983, 0.07),
    ("Somajiguda", 17.4239, 78.4577, 0.04),
    ("Abids", 17.3930, 78.4760, 0.04),
    ("Charminar", 17.3616, 78.4747, 0.06),
    ("Mehdipatnam", 17.3960, 78.4380, 0.04),
    ("Tolichowki", 17.3990, 78.4150, 0.04),
    ("Dilsukhnagar", 17.3688, 78.5247, 0.05),
    ("LB Nagar", 17.3457, 78.5522, 0.03),
    ("Uppal", 17.4058, 78.5591, 0.04),
    ("Kompally", 17.5385, 78.4867, 0.03),
    ("Shamshabad", 17.2403, 78.4294, 0.04),
]

TRIVAGO_LISTINGS = [
    ("Radisson Hyderabad Hitec City", 17.44727, 78.36280, 5, 13924, 8.3, "wifi pool spa parking ac restaurant bar gym"),
    ("Fairfield by Marriott Hyderabad Gachibowli", 17.42376, 78.34739, 4, 12389, 8.2, "wifi spa parking ac restaurant bar gym"),
    ("Townhouse Gachibowli Near Gopichand Academy", 17.43749, 78.35622, 4, 1927, 8.8, "wifi parking pets ac restaurant"),
    ("Collection O SV Delight Inn", 17.43981, 78.32986, 3, 1606, 8.2, "wifi ac restaurant"),
    ("Hotel Deccan Serai Grande, Gachibowli", 17.43731, 78.36716, 4, 25970, 9.2, "wifi pool parking ac restaurant gym"),
    ("Quad Hotels Hyderabad", 17.43607, 78.36957, 4, 5692, 9.4, "wifi parking restaurant gym"),
    ("Super Collection O Sri Balaji Luxury Rooms", 17.43409, 78.36872, 3, 1588, 7.1, "wifi ac"),
    ("Treebo Address Inn Gachibowli", 17.44624, 78.36124, 3, 2307, 8.6, "wifi parking ac"),
    ("32 Urban by Akoya Hotels", 17.43694, 78.36835, 3, 3508, 8.0, "wifi parking ac"),
    ("Super OYO Qualia Inn Kondapur Near Botanical Garden", 17.46066, 78.35467, 3, 1498, 8.1, "wifi parking ac"),
    ("Itsy Hotels D'Comfort Inn", 17.46056, 78.35372, 3, 1564, 7.6, "wifi parking ac"),
    ("Silverkey Gachibowli Near JV Colony", 17.44461, 78.35941, 3, 1364, 7.2, "wifi ac"),
    ("Super Collection O Sharath City Mall Gachibowli", 17.45175, 78.36378, 4, 1119, 7.5, "wifi parking ac restaurant"),
    ("Bloom Hotel - DLF Cyber City", 17.44960, 78.35622, 3, 4914, 8.7, "wifi parking ac restaurant"),
    ("Treebo Trend Pride Inn Botanica", 17.45059, 78.36403, 3, 1760, 8.4, "wifi parking ac restaurant"),
    ("Marriott Executive Apartments Hyderabad", 17.45236, 78.36298, 5, 20060, 9.3, "wifi pool spa parking ac restaurant bar gym"),
    ("The Balcony Suites I Gachibowli", 17.43986, 78.36015, 3, 1273, 8.2, "wifi parking ac"),
    ("Townhouse 1344 Sri Balaji Luxury Rooms", 17.43393, 78.36830, 3, 1975, 8.0, "wifi parking pets ac"),
    ("Swanotel Gachibowli", 17.43584, 78.34679, 3, 2003, 8.9, "wifi spa parking ac restaurant gym"),
    ("Hotel Pratz Inn", 17.44885, 78.35583, 3, 2059, 8.5, "wifi parking ac"),
    ("Le Meridien Hyderabad", 17.44951, 78.36345, 5, 17700, 9.0, "wifi pool spa parking ac restaurant bar gym"),
    ("At Home Suites", 17.44462, 78.36053, 3, 5906, 6.7, "wifi pool parking ac restaurant bar gym"),
    ("Treebo Trend Blue Dawn Gachibowli", 17.44913, 78.35562, 3, 1645, 7.7, "wifi parking ac"),
    ("Bigson Blissful Studios", 17.44249, 78.33357, 0, 2070, 7.9, "wifi ac parking balcony tv"),
    ("Trunk And Trolley Luxury Boutique Hotel, Gachibowli", 17.41691, 78.34238, 3, 5231, 8.6, "wifi pool spa parking ac restaurant gym"),
    ("Super Townhouse Nanakramguda Near WaveRock SEZ", 17.41728, 78.34991, 4, 1659, 7.7, "wifi parking pets ac"),
    ("Oakwood Residence Kapil Hyderabad", 17.42166, 78.33873, 5, 7350, 9.0, "wifi pool parking pets ac restaurant bar gym"),
    ("Lemon Tree Hotel, Gachibowli", 17.42328, 78.33098, 4, 8483, 8.7, "wifi pool spa parking ac restaurant gym"),
    ("Super Collection O Siri Grand Inn", 17.41787, 78.36236, 4, 1401, 6.7, "wifi parking ac"),
    ("The Vantage Inn", 17.41173, 78.34249, 3, 3646, 9.2, "wifi"),
    ("Hyatt Hyderabad Gachibowli", 17.41809, 78.34248, 5, 18880, 8.7, "wifi pool spa parking pets ac restaurant bar gym"),
    ("Sheraton Hyderabad Hotel", 17.42188, 78.33727, 5, 21830, 8.9, "wifi pool spa parking ac restaurant bar gym"),
    ("Harveys Hotels", 17.42508, 78.33221, 3, 1716, 8.3, "wifi parking ac restaurant"),
    ("Grand Maalyasa Hotel and Suites", 17.42653, 78.32959, 3, 2605, 8.0, "wifi parking ac"),
    ("Grand Continent Hotel Gachibowli", 17.42508, 78.33221, 3, 3361, 8.4, "wifi parking ac restaurant gym"),
    ("Yellow Sapphire Hotel Gachibowli", 17.42643, 78.32885, 3, 2876, 8.0, "wifi spa parking ac restaurant gym"),
    ("Luxury 3BHK in Gachibowli Near US Consulate", 17.42498, 78.34798, 0, 11144, 9.6, "kitchen ac parking washer tv pool"),
    ("Bloom Hotel - Financial District", 17.41076, 78.34985, 3, 3585, 6.4, "wifi ac restaurant"),
    ("Skyline View 2.5BHK Near Wipro Circle", 17.42898, 78.35293, 0, 11393, 9.6, "kitchen ac parking washer tv pool"),
    ("Hotel La Hotera", 17.39890, 78.33472, 3, 2055, None, "wifi parking ac restaurant"),
    ("Skyline View Stays 3BHK Gachibowli", 17.42298, 78.34797, 0, 9514, 9.3, "kitchen ac parking washer tv pool"),
    ("Novel Hotel", 17.42509, 78.33221, 3, 2520, None, "parking ac restaurant"),
    ("Premium 2BHK Near Wipro Circle", 17.42397, 78.34798, 0, 7378, 9.5, "kitchen ac parking washer tv pool"),
    ("Leonar Hotel Kokapet", 17.39962, 78.33376, 3, 2147, None, "wifi parking ac restaurant"),
    ("Premium 3BHK at Gachibowli", 17.43591, 78.34691, 0, 7833, 9.0, "kitchen ac parking washer tv"),
    ("Super Townhouse Kokapet Near GAR", 17.39639, 78.33956, 4, 1875, None, "pets"),
    ("Aura Stay Gachibowli", 17.42395, 78.34698, 0, 6143, 9.5, "kitchen ac parking tv pool"),
    ("The Altruist Business Hotel Hitech", 17.46683, 78.36758, 4, 4031, 8.2, "wifi parking ac restaurant bar gym"),
    ("SKYLA Studios & Suites - Kondapur", 17.46928, 78.36706, 4, 12872, 9.4, "wifi parking ac restaurant gym"),
    ("Minerva Grand Kondapur", 17.45799, 78.37123, 3, 4649, 8.1, "wifi parking ac restaurant bar gym"),
    ("Novotel Hyderabad Convention Centre", 17.47285, 78.37284, 5, 31216, 9.0, "wifi pool spa parking ac restaurant bar gym"),
    ("FabHotel Grand Broholic", 17.47726, 78.36240, 3, 1655, 7.4, "ac restaurant"),
    ("The Elite Hotel", 17.48705, 78.35710, 4, 1925, 8.4, "wifi pool spa parking ac restaurant gym"),
    ("Hotel Rudra Grand", 17.46080, 78.36630, 3, 1958, 8.1, "wifi parking ac"),
    ("Collection O SSR Royal Suites", 17.49092, 78.35341, 2, 1334, 6.6, "wifi parking ac"),
    ("Olive Serviced Apartments - HICC", 17.47759, 78.36970, 3, 2403, 9.3, "wifi parking ac gym"),
    ("Aira - The Lake View Villa", 17.48496, 78.34598, 0, 16284, 9.6, "kitchen ac parking washer tv"),
    ("Yellow Bells Studios And Suites", 17.47277, 78.34437, 3, 1345, 9.6, "wifi parking"),
    ("Treebo Trend Acsys - Gachibowli", 17.44920, 78.36247, 3, 2349, 8.1, "wifi ac restaurant"),
    ("OYO Flagship The Botanica Grand", 17.46260, 78.34585, 3, 2611, 7.7, "wifi ac"),
    ("Rio Retreat 2BHK Penthouse", 17.47092, 78.35398, 0, 11481, 9.3, "kitchen ac parking washer tv"),
    ("Yellow Bells Gachibowli", 17.44863, 78.35774, 2, 1691, 9.4, "wifi parking"),
    ("Hotel Athome, Whitefields, Kondapur", 17.45506, 78.36961, 3, 1664, 7.9, "wifi parking ac restaurant gym"),
    ("Holiday Inn Express Hyderabad Hitec City", 17.44720, 78.37331, 3, 9501, 8.0, "wifi parking ac restaurant gym"),
    ("Daspalla Hyderabad", 17.43696, 78.39850, 4, 5807, 8.5, "wifi pool spa parking ac restaurant bar gym"),
    ("Red Fox by Lemon Tree Hotels", 17.44300, 78.37666, 3, 7954, 8.6, "wifi parking ac restaurant gym"),
    ("ibis Hyderabad HITEC City", 17.44748, 78.37886, 3, 7140, 8.5, "wifi parking pets ac restaurant bar gym"),
    ("Ira by Orchid Hitech City", 17.44156, 78.38448, 4, 4200, 8.8, "wifi parking ac restaurant"),
    ("Hotel Silver Cle", 17.44005, 78.38716, 3, 3722, 8.5, "parking ac restaurant gym"),
    ("Lemon Tree Premier, HITEC City", 17.44321, 78.37674, 4, 13270, 8.6, "wifi pool spa parking ac restaurant bar gym"),
    ("The Westin Hyderabad Mindspace", 17.44254, 78.38165, 5, 25960, 9.0, "wifi pool spa parking ac restaurant bar gym"),
    ("Avasa Hotel", 17.44702, 78.38368, 5, 17160, 8.9, "wifi pool spa parking ac restaurant bar gym"),
    ("La Serene", 17.43848, 78.39132, 3, 4538, 8.3, "wifi parking ac restaurant gym"),
    ("Townhouse Halcyon Hi-Tech City", 17.44620, 78.37888, 4, 2457, 7.7, "wifi parking pets ac"),
    ("Hotel Deccan Serai, HITEC City", 17.44285, 78.38261, 3, 9010, 8.6, "wifi parking ac restaurant gym"),
    ("Itsy By Treebo - Infinity Hitech City", 17.46061, 78.38360, 3, 2492, 7.5, "wifi parking ac"),
    ("Golden Hive Madhapur", 17.45332, 78.39458, 3, 1718, 7.7, "wifi parking ac"),
    ("Akoya Business Hotel - Hitech City", 17.44591, 78.38171, 3, 3348, 8.7, "wifi parking ac restaurant gym"),
    ("ITC Kohenur, a Luxury Collection Hotel", 17.43203, 78.38526, 5, 31860, 9.4, "wifi pool parking ac restaurant bar gym"),
    ("ECKO La Maniere Business Hotels", 17.45212, 78.39068, 3, 4196, 7.8, "wifi parking ac"),
    ("23 Urban Square", 17.43954, 78.38867, 3, 3570, 9.3, "wifi ac"),
    ("Skyla Serviced Apartments Jubilee Hills", 17.43261, 78.40104, 3, 12085, 9.3, "wifi parking ac"),
    ("FabHotel Direct CheckIn", 17.44161, 78.38452, 3, 2865, 7.4, "wifi parking ac"),
    ("Olive-2 Coliving", 17.45428, 78.39667, 0, 1356, 8.4, "wifi"),
    ("La Riviera Suites", 17.43644, 78.39075, 3, 1840, 8.0, "wifi parking pets ac restaurant"),
    ("Townhouse Hotel Nera Regency", 17.44468, 78.38610, 3, 2063, 7.8, "wifi parking pets ac restaurant"),
    ("Regenta Z Sunrise Gachibowli", 17.46565, 78.34203, 3, 3653, None, "wifi parking ac restaurant gym"),
    ("BluO 1BHK Suite Gachibowli", 17.43395, 78.36692, 0, 6796, 9.7, "kitchen ac parking washer tv"),
    ("BluO Penthouse Gachibowli", 17.43332, 78.36581, 0, 5514, 8.9, "kitchen ac parking washer tv"),
    ("Draper Startup House Hyderabad", 17.44253, 78.35850, 0, 2226, None, "wifi parking ac restaurant"),
    ("White Fern Stays Serviced Apartments", 17.44632, 78.35933, 3, 2435, None, "wifi parking pets ac"),
    ("Housr 43 Gachibowli", 17.44489, 78.35923, 4, 7620, None, "wifi parking ac restaurant"),
    ("Lovely 2BHK With View Balcony", 17.43381, 78.33187, 0, 4976, 9.6, "kitchen ac parking washer tv"),
    ("Residence Retreat Service Apartments", 17.44089, 78.35702, 0, 2162, None, "wifi kitchen parking balcony"),
    ("Modern 3BHK Near AMB Mall", 17.46200, 78.35500, 3, 4757, 9.5, "parking pets ac"),
    ("Hotel Aurora Bliss Gachibowli", 17.43311, 78.36671, 3, 2831, None, "wifi parking ac restaurant"),
    ("Sakala Sundari 2BHK Near US Consulate", 17.43992, 78.33098, 0, 5307, 9.4, "kitchen ac parking washer tv"),
    ("Casa Nova 1 Bedroom Gachibowli", 17.45670, 78.36781, 0, 2688, None, "kitchen ac parking"),
    ("3BHK Near AIG Hospital", 17.44691, 78.35994, 0, 6290, 9.1, "kitchen ac parking washer tv"),
    ("Hotel O Wildwings", 17.43644, 78.36745, 3, 1470, None, "wifi parking ac"),
    ("The Balcony Suites Narsingi", 17.38552, 78.34351, 3, 2591, 9.1, "wifi parking ac"),
    ("3 BHK Suite Narsingi", 17.38598, 78.34296, 0, 6300, 9.5, "kitchen ac parking washer tv"),
    ("Eeshu Stays", 17.38598, 78.34333, 0, 5906, 9.6, "kitchen ac parking washer tv"),
    ("Hotel Shubham Palace", 17.38721, 78.34055, 3, 3767, None, "wifi parking ac restaurant bar"),
    ("Wild Wings Narsingi", 17.38064, 78.32439, 0, 1324, None, "wifi parking"),
    ("Hotel Marigold Kokapet", 17.38810, 78.32487, 2, 1645, None, "parking"),
    ("PNR Grand Living", 17.38337, 78.33554, 0, 3834, None, ""),
    ("The Golkonda Resort and Spa", 17.38952, 78.31628, 5, 15292, 8.6, "wifi pool spa parking ac restaurant bar gym"),
    ("Ellaa Hotel Gachibowli", 17.44184, 78.34447, 4, 6630, 8.4, "wifi pool spa parking ac restaurant bar gym"),
    ("Collection O White Field Road", 17.45075, 78.36611, 4, 1634, None, "wifi ac restaurant"),
    ("Super Townhouse Gachibowli Flyover", 17.44966, 78.35593, 4, 2369, None, "wifi ac"),
    ("Ikon Towers", 17.46294, 78.34253, 5, 1890, None, "parking ac"),
    ("Palette Naveena Grand", 17.43427, 78.36869, 4, 3245, None, ""),
    ("Botanical Living", 17.45978, 78.35519, 5, 1575, None, "wifi parking ac"),
    ("Mehmaan Guest House", 17.44223, 78.36765, 4, 2940, None, "wifi parking"),
    ("Townhouse Mindspace Road Gachibowli", 17.44337, 78.36634, 4, 1524, None, "wifi ac restaurant"),
    ("Hotel Stayo Gachibowli", 17.44360, 78.33513, 4, 1650, None, "wifi parking ac"),
    ("Sid Royale", 17.44746, 78.35820, 4, 5110, None, "parking ac"),
    ("QUBE Inn", 17.43933, 78.36419, 3, 1418, 7.4, "wifi parking ac restaurant"),
    ("FabHotel Limestone Gachibowli", 17.43907, 78.36672, 3, 2132, 7.9, "wifi ac"),
    ("Trance Babylon Executive Stays", 17.45641, 78.36880, 3, 2076, 8.6, "wifi parking ac restaurant gym"),
    ("Hotel I-stay Hitec", 17.45332, 78.36893, 3, 2603, 7.9, "wifi parking ac gym"),
    ("Bloom Hotel - Gachibowli", 17.44002, 78.36221, 3, 7770, None, "parking gym"),
    ("Yellow Sapphire Hotel DLF Cyber City", 17.44953, 78.35591, 3, 2954, None, "wifi parking ac restaurant"),
    ("Aurum Abodes", 17.40056, 78.38789, 2, 1507, 8.6, "wifi parking pets ac"),
    ("A To Z Guest House", 17.40076, 78.39341, 0, 1987, 7.1, "ac parking"),
    ("FabHotel Starhood - Manikonda", 17.40200, 78.37277, 3, 764, 7.1, "wifi parking ac"),
    ("Hotel Mallikarjuna Residency", 17.40853, 78.38999, 3, 1040, 8.8, "wifi parking pets ac restaurant"),
    ("Treebo Trip And Suits", 17.41678, 78.39005, 4, 4029, 8.2, "wifi parking ac restaurant"),
    ("3 BHK Suite Raidurg", 17.41797, 78.37894, 0, 7350, 9.3, "kitchen ac parking washer tv"),
    ("Huma Grand Lake View Stay", 17.41326, 78.37231, 0, 5198, None, "parking"),
    ("Chithrapuri Homes 3BHK Manikonda", 17.41697, 78.37296, 0, 7109, 9.4, "kitchen ac parking washer tv"),
    ("Townhouse Oak Premier Raidurg Biodiversity Park", 17.41758, 78.36819, 4, 2493, None, "wifi parking ac gym"),
    ("Shreshtam Serviced Apartment 2BHK", 17.41295, 78.37098, 0, 7232, 8.8, "kitchen ac parking washer tv"),
    ("Treebo S3 Suites, Manikonda", 17.39643, 78.36995, 3, 2389, None, "wifi parking ac"),
    ("2BHK Cozy Home Stay Film Nagar", 17.41361, 78.40693, 0, 4433, 9.7, "kitchen ac parking washer"),
    ("NK Suites & Serviced Apartments", 17.41415, 78.38308, 3, 1672, None, "wifi ac"),
    ("Lake View Flat Near Lanco Hills", 17.41494, 78.37092, 0, 4725, 9.5, "kitchen ac parking washer tv"),
    ("Madhura Luxury Hotel Gachibowli", 17.39996, 78.36458, 3, 2211, None, "wifi parking"),
    ("1BHK Hill Plaza Suite", 17.40998, 78.39793, 0, 2625, 9.3, "kitchen ac parking washer tv"),
    ("Hotel O JVP Hotels", 17.40233, 78.37271, 3, 1402, None, "wifi ac"),
    ("Stylish 2BHK Apartment Shaikpet", 17.40298, 78.40697, 0, 2772, 9.5, "kitchen ac washer tv"),
    ("Hotel O Ayyappa Grand Inn", 17.41793, 78.37784, 3, 1177, None, "wifi ac"),
    ("Vibrant Comfort Studio Film Nagar", 17.41294, 78.40795, 0, 2996, 9.5, "kitchen ac parking washer tv"),
    ("Dumzys Bungalow", 17.39944, 78.39855, 0, 930, None, "wifi parking balcony washer"),
    ("Zivo Stays Hideaway Jubilee Hills", 17.40995, 78.40195, 0, 2415, 9.5, "kitchen ac parking washer tv"),
    ("Cozy Manikonda Stay Near Financial District", 17.40266, 78.38795, 0, 1256, None, "wifi ac balcony"),
    ("Home Stay Near Shaikpet", 17.40721, 78.40131, 0, 2231, None, ""),
    ("RCC Hotels Helix Gachibowli", 17.42210, 78.37970, 3, 2651, None, "wifi parking ac"),
    ("Hotel Indiana Hitech City", 17.47925, 78.36878, 4, 2534, None, "wifi parking ac restaurant"),
    ("Ultra-Modern 2BHK Near JNTU Campus", 17.49691, 78.37996, 0, 4092, 9.7, "kitchen ac parking washer tv"),
    ("Super Townhouse Miyapur Metro Station", 17.48064, 78.36574, 3, 1908, None, "wifi ac restaurant"),
    ("Minimal 2BHK at Kondapur", 17.47398, 78.36094, 0, 4464, 9.5, "kitchen ac parking washer tv"),
    ("R3 Atmos Live", 17.47899, 78.36859, 0, 1915, None, "wifi ac parking"),
    ("Own Space 1BHK Kondapur", 17.47993, 78.35197, 0, 1777, 9.5, "kitchen ac parking tv"),
    ("Townhouse JP Nagar Miyapur", 17.50567, 78.35837, 3, 1795, None, "wifi parking"),
    ("Convenient Flat in Hafeezpet", 17.48398, 78.36198, 0, 3073, 9.1, "kitchen ac parking washer tv"),
    ("Hotel O Hyderabad City Centre", 17.51068, 78.36699, 3, 1086, None, "wifi parking"),
    ("No-Frills 2BHK Flat in Hafeezpet", 17.48398, 78.36198, 0, 3130, 9.2, "kitchen ac washer tv"),
    ("Hotel Vamshi Grand", 17.49520, 78.33890, 0, 1755, None, "wifi parking ac"),
    ("Projector Couple Stay Kondapur", 17.47994, 78.34993, 0, 2108, 8.9, "kitchen ac parking tv"),
    ("Hotel O Lavish Tranquil", 17.49527, 78.36089, 4, 1912, None, "wifi ac"),
    ("Yendluri's Studio Flat 2, Kondapur", 17.48198, 78.34397, 0, 2289, 9.3, "kitchen ac parking washer tv"),
    ("Hotel O Top Inn", 17.50533, 78.36162, 3, 1541, None, "wifi ac"),
    ("Yendluri's Studio Flat 5, Kondapur", 17.48198, 78.34397, 0, 2562, 9.2, "kitchen ac parking washer tv"),
    ("FabHotel Grand Aarvi Prime", 17.50024, 78.34753, 3, 1778, None, ""),
    ("2BHK Furnished in Hafeezpet", 17.48193, 78.36894, 0, 3042, 9.0, "kitchen ac parking washer tv"),
    ("Super Townhouse Oak Hyderabad Central University", 17.50973, 78.36394, 3, 1611, None, ""),
    ("FabHotel Larana", 17.48616, 78.35873, 3, 968, None, "wifi ac"),
    ("Vinflora Residency", 17.42958, 78.42958, 4, 3548, 8.0, "wifi parking ac restaurant"),
    ("OYO Sri Nirvana Inn", 17.44470, 78.38728, 4, 1957, 8.1, "wifi ac"),
    ("Emerald Suites 3BHK in Madhapur", 17.44595, 78.39098, 0, 11649, 9.5, "kitchen ac parking washer tv"),
    ("Treebo Tryst Tree Inn Jubilee", 17.42657, 78.41415, 3, 2581, 9.1, "wifi parking ac restaurant"),
    ("Five Star Residences Madhapur", 17.44091, 78.39591, 0, 9851, 9.6, "kitchen ac parking washer tv"),
    ("Horizon Residency", 17.44563, 78.39247, 3, 1721, 7.5, "wifi parking"),
    ("OYO Raghava Guest House", 17.42995, 78.42612, 4, 1777, 7.1, "wifi ac"),
    ("Ebony Boutique Hotel", 17.42462, 78.42274, 3, 4096, 7.7, "wifi parking ac restaurant"),
    ("Elegant Villa Film Nagar", 17.41497, 78.40897, 0, 10750, 9.5, "kitchen ac parking washer tv"),
    ("Collection O Madhapur Near Cyber Tower", 17.45217, 78.39872, 3, 1723, 8.8, "wifi parking pets ac"),
    ("Autumn Suites 2BHK in Madhapur", 17.44595, 78.39098, 0, 9618, 9.4, "kitchen ac parking washer tv"),
    ("Capital O Luxor Park", 17.43805, 78.38982, 3, 2625, 8.5, "wifi parking ac restaurant gym"),
    ("Restel Ecoline Wooden Cottage", 17.45094, 78.39998, 0, 7875, 9.5, "ac parking washer tv"),
    ("Our Nest Banjara", 17.42526, 78.42877, 3, 2318, 8.2, "wifi parking ac"),
    ("Four Bedroom Serviced Apartment Madhapur", 17.43795, 78.38998, 0, 6825, 9.3, "ac parking tv"),
    ("Mint Ebony", 17.42539, 78.42314, 3, 3569, 8.0, "wifi parking ac restaurant"),
    ("Hotel O Mid Town", 17.48431, 78.38959, 4, 938, 8.2, "wifi parking ac"),
    ("Super Collection O Qualia Prime Near Nexus Mall", 17.48737, 78.38299, 3, 1980, 7.9, "wifi ac"),
    ("FabHotel Sri Karthikeya Grand", 17.48453, 78.38054, 3, 1375, 7.7, "wifi parking ac"),
    ("Super OYO JNTU Near Lulu Mall", 17.49839, 78.39492, 3, 1569, 6.8, "wifi parking ac"),
    ("Townhouse 1388 Hotel SV Royal Inn", 17.49852, 78.39519, 4, 1627, 8.8, "wifi parking restaurant"),
    ("OYO Flagship Hillside Hotel Kukatpally", 17.49592, 78.39911, 4, 1402, 7.3, "wifi parking ac restaurant"),
    ("Hasini Homes Premium Stays", 17.50783, 78.39220, 0, 5565, 9.3, "ac parking balcony"),
    ("ZIBE Hyderabad by GRT Hotels", 17.49272, 78.40260, 3, 4937, 9.1, "wifi parking ac restaurant gym"),
    ("Sula Stays", 17.48489, 78.38712, 3, 2646, 9.0, "wifi parking"),
    ("Hotel Shresta Luxury Rooms Nizampet", 17.50646, 78.38378, 3, 1674, 7.7, ""),
    ("5BHK Duplex With Rooftop Lawn", 17.47598, 78.38695, 0, 15918, 9.7, "kitchen ac parking washer tv"),
    ("OYO Anuguna Tulasi Grand", 17.49713, 78.39783, 2, 1695, 8.5, "wifi parking ac"),
    ("Super OYO Flagship Prime Time Hotel", 17.49673, 78.39134, 3, 1658, 8.6, "wifi ac"),
    ("Hill View 3BHK Kukatpally", 17.47598, 78.38695, 0, 7340, 9.7, "kitchen ac parking washer tv"),
    ("Highway Grand Residency", 17.49358, 78.40311, 0, 1617, 6.9, "pool"),
    ("Veetil 3BHK Kukatpally", 17.49292, 78.40692, 0, 5542, 9.7, "kitchen ac parking washer tv"),
    ("Veetil 3BHK KPHB", 17.49439, 78.41104, 0, 5422, 9.8, "kitchen ac parking washer tv"),
    ("Veetil Penthouse 2BHK KPHB", 17.49292, 78.40692, 0, 5542, 9.7, "kitchen ac parking washer tv"),
    ("Super OYO Flagship Big Daddy Suites", 17.48130, 78.39210, 4, 1811, None, "wifi parking ac restaurant"),
    ("Woodland Cottage With Jacuzzi", 17.47992, 78.41697, 0, 6630, 9.1, "ac parking tv"),
    ("V Square Elite", 17.48363, 78.38722, 2, 1544, None, "wifi parking ac"),
    ("The Palazzo", 17.48134, 78.39199, 3, 2850, 7.8, "wifi spa parking ac restaurant"),
    ("Townhouse Nexus Mall", 17.48120, 78.38160, 4, 1550, None, "wifi ac restaurant"),
    ("Lemonridge by Monday Hotels KPHB", 17.48590, 78.38746, 3, 3989, None, "wifi parking ac restaurant"),
]

PROPERTY_TYPES = [
    "Luxury Villa",
    "Modern Apartment",
    "Heritage Home",
    "Boutique Suite",
    "Lakeview Flat",
    "Cozy Studio",
    "Serviced Apartment",
    "Family Home",
    "Penthouse",
    "Garden Cottage",
    "Tech Park Condo",
    "Rooftop Studio",
]


def money(low: float, high: float) -> Decimal:
    return Decimal(str(random.uniform(low, high))).quantize(CENT)


def point_near(lat: float, lon: float, radius_km: float) -> tuple[float, float]:
    """Random point within radius_km of (lat, lon), uniform over the disc."""
    angle = random.uniform(0, 2 * math.pi)
    r = radius_km * math.sqrt(random.random())
    dlat = r * math.cos(angle) / 111.32
    dlon = r * math.sin(angle) / (111.32 * math.cos(math.radians(lat)))
    return round(lat + dlat, 6), round(lon + dlon, 6)


def generate_properties(count: int) -> list[tuple]:
    """Every trivago listing, then synthetic homes near weighted localities up to count."""
    properties = [
        (str(uuid.uuid4()), name, Decimal(price).quantize(CENT), lat, lon)
        for name, lat, lon, _, price, _, _ in TRIVAGO_LISTINGS
    ]
    real_prices = [listing[4] for listing in TRIVAGO_LISTINGS]
    weights = [locality[3] for locality in LOCALITIES]
    for _ in range(count - len(properties)):
        locality, lat, lon, _ = random.choices(LOCALITIES, weights=weights)[0]
        lat, lon = point_near(lat, lon, 1.2)
        # Price a synthetic home like a random real listing, give or take 20%.
        price = Decimal(str(random.choice(real_prices) * random.uniform(0.8, 1.2))).quantize(CENT)
        title = f"{random.choice(PROPERTY_TYPES)} in {locality}"
        properties.append((str(uuid.uuid4()), title, price, lat, lon))
    return properties


def generate_bookings(
    guest_ids: list[str], properties: list[tuple], count: int, now: datetime
) -> dict[str, list[dict]]:
    """Return bookings grouped by guest, oldest first, with statuses assigned."""
    by_guest = defaultdict(list)
    for _ in range(count):
        prop_id, _, base_price, _, _ = random.choice(properties)
        nights = random.randint(1, 14)
        by_guest[random.choice(guest_ids)].append(
            {
                "id": str(uuid.uuid4()),
                "property_id": prop_id,
                "nights": nights,
                "total_cost": base_price * nights,
                "created_at": now
                - timedelta(seconds=random.randint(0, HISTORY_DAYS * 86400)),
            }
        )

    for bookings in by_guest.values():
        bookings.sort(key=lambda b: b["created_at"])
        for booking in bookings[:-1]:
            booking["status"] = random.choices(
                ["COMPLETED", "CONFIRMED"], weights=[0.9, 0.1]
            )[0]
        # Only the latest booking can be CHECKED_IN.
        bookings[-1]["status"] = random.choices(
            ["CHECKED_IN", "CONFIRMED", "COMPLETED"], weights=[0.4, 0.3, 0.3]
        )[0]
    return by_guest


def build_ledger(
    guest_id: str, bookings: list[dict], now: datetime
) -> tuple[list[tuple], Decimal]:
    """Return (audit rows, final balance) for one guest's bookings."""
    rows = []
    balance = Decimal("0.00")

    def add(action: str, amount: Decimal, at: datetime):
        nonlocal balance
        balance += amount if action == "CREDIT" else -amount
        rows.append((str(uuid.uuid4()), guest_id, amount, action, balance, at))

    first = bookings[0]["created_at"] if bookings else now
    last_time = first - timedelta(days=random.randint(1, 30))
    add("CREDIT", money(15000.0, 250000.0), last_time)

    for booking in bookings:
        cost, booked_at = booking["total_cost"], booking["created_at"]
        if balance < cost:
            gap = max((booked_at - last_time).total_seconds(), 2)
            top_up_at = booked_at - timedelta(
                seconds=random.uniform(1, min(gap - 1, 3 * 86400))
            )
            add("CREDIT", (cost - balance) + money(5000.0, 100000.0), top_up_at)
        add("DEBIT", cost, booked_at)
        last_time = booked_at
    return rows, balance


def add_extra_credits(
    ledgers: dict[str, list[tuple]],
    balances: dict[str, Decimal],
    needed: int,
    now: datetime,
):
    """Append top-ups after each chosen guest's last row, so earlier balance_after values stay correct."""
    guest_ids = list(ledgers)
    for _ in range(needed):
        guest_id = random.choice(guest_ids)
        last_time = ledgers[guest_id][-1][5]
        at = last_time + (now - last_time) * random.random()
        amount = money(1000.0, 40000.0)
        balances[guest_id] += amount
        ledgers[guest_id].append(
            (str(uuid.uuid4()), guest_id, amount, "CREDIT", balances[guest_id], at)
        )


def insert(cursor, table: str, columns: str, rows: list[tuple], batch_size: int):
    execute_values(
        cursor, f"INSERT INTO {table} ({columns}) VALUES %s", rows, page_size=batch_size
    )
    print(f"  -> Inserted {len(rows):,} {table}")


def main():
    parser = argparse.ArgumentParser(description="StaySpot PostgreSQL Seeder")
    parser.add_argument(
        "--uri",
        default=os.environ.get(
            "PG_URI", "postgresql://postgres:postgres@localhost:5432/stayspot"
        ),
        help="PostgreSQL URI (default: $PG_URI)",
    )
    parser.add_argument(
        "--guests", type=int, default=GUEST_COUNT, help="Number of guests"
    )
    parser.add_argument(
        "--properties", type=int, default=PROPERTY_COUNT, help="Number of properties"
    )
    parser.add_argument(
        "--bookings", type=int, default=BOOKING_COUNT, help="Number of bookings"
    )
    parser.add_argument(
        "--audits",
        type=int,
        default=AUDIT_LOG_COUNT,
        help="Minimum number of audit log entries",
    )
    parser.add_argument("--batch", type=int, default=BATCH_SIZE, help="Batch size")
    args = parser.parse_args()

    print("=" * 60)
    print("StaySpot PostgreSQL Seeder")
    print("=" * 60)
    print(f"PostgreSQL: {args.uri}")
    print(
        f"Guests: {args.guests:,}  Properties: {args.properties:,}  Bookings: {args.bookings:,}  Audit logs: >= {args.audits:,}"
    )
    print()

    now = datetime.now(timezone.utc)
    guest_ids = [str(uuid.uuid4()) for _ in range(args.guests)]
    properties = generate_properties(args.properties)
    bookings_by_guest = generate_bookings(guest_ids, properties, args.bookings, now)

    ledgers, balances = {}, {}
    for guest_id in guest_ids:
        ledgers[guest_id], balances[guest_id] = build_ledger(
            guest_id, bookings_by_guest.get(guest_id, []), now
        )
    shortfall = args.audits - sum(len(rows) for rows in ledgers.values())
    if shortfall > 0:
        add_extra_credits(ledgers, balances, shortfall, now)

    guests = [(gid, fake.name(), balances[gid]) for gid in guest_ids]
    bookings = [
        (
            b["id"],
            gid,
            b["property_id"],
            b["nights"],
            b["total_cost"],
            b["status"],
            b["created_at"],
        )
        for gid, rows in bookings_by_guest.items()
        for b in rows
    ]
    audits = [row for rows in ledgers.values() for row in rows]

    conn = psycopg2.connect(args.uri)
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "TRUNCATE TABLE wallet_audit_logs, bookings, properties, guests CASCADE"
            )
            insert(cursor, "guests", "id, name, wallet_balance", guests, args.batch)
            insert(
                cursor,
                "properties",
                "id, title, base_price, latitude, longitude",
                properties,
                args.batch,
            )
            insert(
                cursor,
                "bookings",
                "id, guest_id, property_id, nights, total_cost, status, created_at",
                bookings,
                args.batch,
            )
            insert(
                cursor,
                "wallet_audit_logs",
                "id, guest_id, amount_changed, action_type, balance_after, timestamp",
                audits,
                args.batch,
            )
            cursor.execute("SELECT refresh_mv_property_summary()")
            print("  -> Refreshed mv_property_summary")
        conn.commit()

        # VACUUM cannot run inside a transaction. It sets the visibility map so
        # the planner can use index-only scans on the new rows.
        conn.autocommit = True
        with conn.cursor() as cursor:
            cursor.execute("VACUUM ANALYZE")
        print("  -> VACUUM ANALYZE done")
        print("\nPostgreSQL seeding completed successfully.")
    except Exception as e:
        print(f"\nError: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
